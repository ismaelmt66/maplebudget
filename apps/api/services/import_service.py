"""Transaction import service: CSV and OFX/QFX parsing with auto-categorization."""

from __future__ import annotations

import csv
import io
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

import models


@dataclass
class ImportedTransaction:
    date: str
    amount: float
    description: str
    external_id: Optional[str] = None
    category_hint: Optional[str] = None


@dataclass
class ImportResult:
    imported: int
    skipped: int
    errors: list[str]
    transactions: list[dict]


# ── CSV Parsing ──────────────────────────────────────────────────────

_KNOWN_DATE_FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y"]


def _parse_date(raw: str) -> Optional[str]:
    raw = raw.strip()
    for fmt in _KNOWN_DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _detect_csv_columns(headers: list[str]) -> dict[str, int]:
    """Map canonical column names to header indices using heuristics."""
    mapping: dict[str, int] = {}
    lower = [h.strip().lower() for h in headers]

    date_aliases = {"date", "transaction date", "trans date", "posted date", "posting date"}
    amount_aliases = {"amount", "montant", "value", "transaction amount", "debit/credit"}
    desc_aliases = {"description", "memo", "note", "details", "payee", "merchant", "libellé", "libelle"}
    category_aliases = {"category", "catégorie", "categorie", "type"}

    for i, h in enumerate(lower):
        if h in date_aliases:
            mapping["date"] = i
        elif h in amount_aliases:
            mapping["amount"] = i
        elif h in desc_aliases:
            mapping["description"] = i
        elif h in category_aliases:
            mapping["category"] = i

    if "date" not in mapping:
        for i, h in enumerate(lower):
            if "date" in h:
                mapping["date"] = i
                break

    if "amount" not in mapping:
        for i, h in enumerate(lower):
            if any(kw in h for kw in ("amount", "montant", "value", "debit", "credit")):
                mapping["amount"] = i
                break

    if "description" not in mapping:
        for i, h in enumerate(lower):
            if any(kw in h for kw in ("desc", "memo", "note", "payee", "merchant", "libel")):
                mapping["description"] = i
                break

    return mapping


def parse_csv(content: str) -> tuple[list[ImportedTransaction], list[str]]:
    """Parse CSV content and return transactions + errors."""
    transactions: list[ImportedTransaction] = []
    errors: list[str] = []

    reader = csv.reader(io.StringIO(content))
    rows = list(reader)
    if len(rows) < 2:
        return [], ["CSV file is empty or has no data rows"]

    col_map = _detect_csv_columns(rows[0])
    if "date" not in col_map or "amount" not in col_map:
        return [], ["Cannot detect required columns (date, amount). Please ensure your CSV has Date and Amount headers."]

    for i, row in enumerate(rows[1:], start=2):
        try:
            if not any(cell.strip() for cell in row):
                continue

            date_raw = row[col_map["date"]].strip()
            date_str = _parse_date(date_raw)
            if not date_str:
                errors.append(f"Row {i}: unrecognized date format '{date_raw}'")
                continue

            amount_raw = row[col_map["amount"]].strip().replace(",", "").replace("$", "").replace("€", "").replace(" ", "")
            try:
                amount = float(amount_raw)
            except ValueError:
                errors.append(f"Row {i}: invalid amount '{row[col_map['amount']].strip()}'")
                continue

            desc = row[col_map.get("description", col_map.get("date", 0))].strip() if "description" in col_map else ""
            cat_hint = row[col_map["category"]].strip() if "category" in col_map and col_map["category"] < len(row) else None

            transactions.append(ImportedTransaction(
                date=date_str,
                amount=abs(amount),
                description=desc,
                category_hint=cat_hint,
                external_id=f"csv-{date_str}-{amount_raw}-{desc[:30]}",
            ))
        except (IndexError, ValueError) as e:
            errors.append(f"Row {i}: {e}")

    return transactions, errors


# ── OFX / QFX Parsing ──────────────────────────────────────────────

def _strip_ofx_header(content: str) -> str:
    """Strip the SGML header from OFX 1.x files and return just the XML body."""
    idx = content.find("<OFX>")
    if idx == -1:
        idx = content.find("<ofx>")
    if idx == -1:
        return content
    return content[idx:]


def _ofx_date_to_ymd(ofx_date: str) -> Optional[str]:
    """Convert OFX date format (YYYYMMDDHHMMSS) to YYYY-MM-DD."""
    clean = ofx_date.strip()[:8]
    if len(clean) < 8:
        return None
    try:
        return datetime.strptime(clean, "%Y%m%d").strftime("%Y-%m-%d")
    except ValueError:
        return None


def _close_ofx_tags(xml_str: str) -> str:
    """OFX 1.x uses unclosed tags; close them for XML parsing."""
    open_tag = re.compile(r"^<(\w+)>(.+)$")
    lines = xml_str.split("\n")
    result_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            result_lines.append(line)
            continue
        match = open_tag.match(stripped)
        if match:
            tag_name = match.group(1)
            rest = match.group(2)
            if f"</{tag_name}>" not in rest and not rest.startswith("<"):
                result_lines.append(f"<{tag_name}>{rest}</{tag_name}>")
                continue
        result_lines.append(line)
    return "\n".join(result_lines)


def parse_ofx(content: str) -> tuple[list[ImportedTransaction], list[str]]:
    """Parse OFX/QFX content and return transactions + errors."""
    transactions: list[ImportedTransaction] = []
    errors: list[str] = []

    try:
        xml_body = _strip_ofx_header(content)
        xml_body = _close_ofx_tags(xml_body)
        xml_body = xml_body.replace("&", "&amp;")

        root = ET.fromstring(xml_body)

        for stmttrn in root.iter("STMTTRN"):
            try:
                dtposted_el = stmttrn.find("DTPOSTED")
                trnamt_el = stmttrn.find("TRNAMT")
                name_el = stmttrn.find("NAME")
                memo_el = stmttrn.find("MEMO")
                fitid_el = stmttrn.find("FITID")

                if trnamt_el is None or trnamt_el.text is None:
                    continue

                amount = float(trnamt_el.text.strip())
                date_str = _ofx_date_to_ymd(dtposted_el.text) if dtposted_el is not None and dtposted_el.text else None
                if not date_str:
                    errors.append("Skipping transaction with invalid date")
                    continue

                desc = (name_el.text if name_el is not None and name_el.text else
                        memo_el.text if memo_el is not None and memo_el.text else "")
                fitid = fitid_el.text.strip() if fitid_el is not None and fitid_el.text else None

                transactions.append(ImportedTransaction(
                    date=date_str,
                    amount=abs(amount),
                    description=desc.strip(),
                    external_id=f"ofx-{fitid}" if fitid else None,
                    category_hint="income" if amount > 0 else "expense",
                ))
            except (ValueError, AttributeError) as e:
                errors.append(f"OFX transaction parse error: {e}")

    except ET.ParseError as e:
        errors.append(f"OFX XML parse error: {e}")

    return transactions, errors


# ── Auto-categorization ──────────────────────────────────────────────

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Alimentation": ["grocery", "epicerie", "supermarket", "metro", "iga", "costco", "walmart", "food", "restaurant", "cafe", "coffee", "mcdonald", "subway", "tim horton", "starbucks"],
    "Transport": ["gas", "essence", "shell", "petro", "uber", "lyft", "taxi", "stm", "transit", "parking"],
    "Logement": ["rent", "loyer", "mortgage", "hydro", "electricity", "internet", "bell", "rogers", "videotron", "telus"],
    "Santé": ["pharmacy", "pharmacie", "jean coutu", "medical", "dentist", "doctor", "hospital"],
    "Loisirs": ["netflix", "spotify", "amazon prime", "disney", "cinema", "theatre", "gym", "sport"],
    "Abonnements": ["subscription", "abonnement", "membership", "patreon", "apple", "google play"],
    "Vêtements": ["clothing", "vetement", "h&m", "zara", "old navy", "gap", "simons", "winners"],
    "Salaire": ["salary", "salaire", "payroll", "paie", "deposit", "direct deposit"],
}


def auto_categorize(description: str, categories: list[models.Category]) -> Optional[int]:
    """Match a transaction description to an existing user category using keyword heuristics."""
    desc_lower = description.lower()

    for keyword_cat, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in desc_lower for kw in keywords):
            for cat in categories:
                if keyword_cat.lower() in cat.name.lower():
                    return cat.id
            break

    for cat in categories:
        cat_words = cat.name.lower().replace("🏠", "").replace("🍔", "").replace("🚗", "").replace("💼", "").strip().split()
        for word in cat_words:
            if len(word) > 2 and word in desc_lower:
                return cat.id

    return None


# ── Import Orchestrator ──────────────────────────────────────────────

def import_transactions(
    db: Session,
    user_id: int,
    parsed: list[ImportedTransaction],
    default_category_id: int,
) -> ImportResult:
    """Import parsed transactions into the database with deduplication."""
    categories = db.query(models.Category).filter(models.Category.user_id == user_id).all()
    imported_txs: list[dict] = []
    skipped = 0
    errors: list[str] = []

    for tx in parsed:
        if tx.external_id:
            existing = db.query(models.Transaction).filter(
                models.Transaction.user_id == user_id,
                models.Transaction.external_id == tx.external_id,
            ).first()
            if existing:
                skipped += 1
                continue

        cat_id = auto_categorize(tx.description, categories) or default_category_id

        new_tx = models.Transaction(
            amount=tx.amount,
            date=tx.date,
            note=tx.description[:255] if tx.description else None,
            category_id=cat_id,
            user_id=user_id,
            external_id=tx.external_id,
        )
        db.add(new_tx)
        imported_txs.append({
            "date": tx.date,
            "amount": tx.amount,
            "description": tx.description,
            "category_id": cat_id,
        })

    db.commit()
    return ImportResult(
        imported=len(imported_txs),
        skipped=skipped,
        errors=errors,
        transactions=imported_txs,
    )
