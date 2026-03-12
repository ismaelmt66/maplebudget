"""Export service for transactions: CSV and PDF generation.

Provides ``ExportService`` which encapsulates CSV string building and PDF
generation (via fpdf2) with optional summary statistics.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from typing import Optional

try:
    from fpdf import FPDF
    _FPDF_AVAILABLE = True
except ImportError:  # pragma: no cover
    _FPDF_AVAILABLE = False

# Maximum number of characters shown in the Note column of PDF exports.
# Longer notes are truncated with "…" to prevent table overflow.
_PDF_NOTE_MAX_LENGTH = 30

@dataclass
class ExportFilters:
    """Filters applied before generating an export."""

    date_from: Optional[str] = None   # YYYY-MM-DD inclusive
    date_to: Optional[str] = None     # YYYY-MM-DD inclusive
    category_id: Optional[int] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None


@dataclass
class SummaryStats:
    """Aggregated statistics computed over a transaction list."""

    count: int
    total: float
    average: float
    minimum: float
    maximum: float


def _apply_filters(transactions: list[dict], filters: ExportFilters) -> list[dict]:
    """Return only transactions that match *all* specified filters.

    Parameters
    ----------
    transactions:
        Each item must contain at least the keys ``date`` (YYYY-MM-DD
        string), ``amount`` (float), and ``category_id`` (int).
    filters:
        ``ExportFilters`` instance; ``None`` fields are ignored.

    Returns
    -------
    list[dict]
        Filtered subset preserving the original ordering.
    """
    result = []
    for tx in transactions:
        if filters.date_from and tx.get("date", "") < filters.date_from:
            continue
        if filters.date_to and tx.get("date", "") > filters.date_to:
            continue
        if filters.category_id is not None and tx.get("category_id") != filters.category_id:
            continue
        try:
            amount = float(tx.get("amount", 0))
        except (TypeError, ValueError):
            amount = 0.0
        if filters.amount_min is not None and amount < filters.amount_min:
            continue
        if filters.amount_max is not None and amount > filters.amount_max:
            continue
        result.append(tx)
    return result


def _compute_summary(transactions: list[dict]) -> SummaryStats:
    """Compute aggregate statistics over a list of transactions.

    Returns a :class:`SummaryStats` with ``count=0`` and all numeric
    fields set to ``0.0`` when the list is empty.
    """
    if not transactions:
        return SummaryStats(count=0, total=0.0, average=0.0, minimum=0.0, maximum=0.0)

    amounts = []
    for tx in transactions:
        try:
            amounts.append(float(tx.get("amount", 0)))
        except (TypeError, ValueError):
            amounts.append(0.0)
    total = sum(amounts)
    return SummaryStats(
        count=len(amounts),
        total=round(total, 2),
        average=round(total / len(amounts), 2),
        minimum=round(min(amounts), 2),
        maximum=round(max(amounts), 2),
    )


class ExportService:
    """High-level service that converts transaction data to CSV or PDF bytes."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate_csv(
        self,
        transactions: list[dict],
        filters: Optional[ExportFilters] = None,
    ) -> bytes:
        """Return UTF-8-encoded CSV bytes for *transactions* after filtering.

        The CSV includes a summary section (count, total, average) appended
        as commented rows at the end so spreadsheet apps can open it cleanly.

        Parameters
        ----------
        transactions:
            Raw transaction dicts from the database layer.  Expected keys:
            ``id``, ``date``, ``amount``, ``note``, ``category_name``,
            ``category_type``, ``category_id``.
        filters:
            Optional ``ExportFilters``; all fields default to ``None``
            (no filtering).

        Returns
        -------
        bytes
            CSV content encoded as UTF-8 with BOM so Excel opens it with
            the correct encoding automatically.
        """
        if filters is not None:
            transactions = _apply_filters(transactions, filters)

        stats = _compute_summary(transactions)

        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\n")

        writer.writerow(["ID", "Date", "Category", "Type", "Amount", "Note"])
        for tx in transactions:
            writer.writerow([
                tx.get("id", ""),
                tx.get("date", ""),
                tx.get("category_name", ""),
                tx.get("category_type", ""),
                tx.get("amount", 0),
                tx.get("note", "") or "",
            ])

        # Summary block (prefixed with '#' so it is easy to strip)
        writer.writerow([])
        writer.writerow(["# Summary"])
        writer.writerow(["# Count", stats.count])
        writer.writerow(["# Total", stats.total])
        writer.writerow(["# Average", stats.average])
        writer.writerow(["# Minimum", stats.minimum])
        writer.writerow(["# Maximum", stats.maximum])

        # BOM makes Excel auto-detect UTF-8
        return ("\ufeff" + output.getvalue()).encode("utf-8")

    def generate_pdf(
        self,
        transactions: list[dict],
        filters: Optional[ExportFilters] = None,
        title: str = "Transactions Export",
    ) -> bytes:
        """Return PDF bytes for *transactions* after filtering.

        Requires the *fpdf2* package.  Raises ``RuntimeError`` if fpdf2 is
        not installed.

        Parameters
        ----------
        transactions:
            Same format as :meth:`generate_csv`.
        filters:
            Optional ``ExportFilters``.
        title:
            Title printed at the top of the first page.

        Returns
        -------
        bytes
            Raw PDF bytes ready to send as a file download.
        """
        if not _FPDF_AVAILABLE:
            raise RuntimeError(  # pragma: no cover
                "fpdf2 is required for PDF export. "
                "Install it with: pip install fpdf2"
            )

        if filters is not None:
            transactions = _apply_filters(transactions, filters)

        stats = _compute_summary(transactions)
        pdf = _build_pdf(transactions, stats, title)
        return bytes(pdf.output())

    # Expose helpers for use in tests / other services
    @staticmethod
    def apply_filters(
        transactions: list[dict], filters: ExportFilters
    ) -> list[dict]:
        """Thin public wrapper around :func:`_apply_filters`."""
        return _apply_filters(transactions, filters)

    @staticmethod
    def compute_summary(transactions: list[dict]) -> SummaryStats:
        """Thin public wrapper around :func:`_compute_summary`."""
        return _compute_summary(transactions)


# ------------------------------------------------------------------
# PDF layout helpers
# ------------------------------------------------------------------

def _build_pdf(
    transactions: list[dict],
    stats: SummaryStats,
    title: str,
) -> "FPDF":
    """Construct and return an ``FPDF`` instance with the full report."""
    from fpdf.enums import XPos, YPos  # type: ignore[import]

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    pdf.ln(4)

    # Summary box
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 8, "Summary", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"  Transactions: {stats.count}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 6, f"  Total:        {stats.total:.2f}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 6, f"  Average:      {stats.average:.2f}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 6, f"  Min / Max:    {stats.minimum:.2f} / {stats.maximum:.2f}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(6)

    # Table header
    col_widths = [15, 28, 45, 22, 28, 52]
    headers = ["ID", "Date", "Category", "Type", "Amount", "Note"]
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(230, 230, 230)
    for w, h in zip(col_widths, headers):
        pdf.cell(w, 7, h, border=1, fill=True)
    pdf.ln()

    # Rows
    pdf.set_font("Helvetica", "", 8)
    fill = False
    pdf.set_fill_color(245, 245, 245)
    for tx in transactions:
        note = str(tx.get("note", "") or "")
        # Truncate long notes so they fit the cell
        if len(note) > _PDF_NOTE_MAX_LENGTH:
            note = note[:_PDF_NOTE_MAX_LENGTH - 3] + "..."
        row = [
            str(tx.get("id", "")),
            str(tx.get("date", "")),
            str(tx.get("category_name", "")),
            str(tx.get("category_type", "")),
            f"{float(tx.get('amount', 0)):.2f}",
            note,
        ]
        for w, val in zip(col_widths, row):
            pdf.cell(w, 6, val, border=1, fill=fill)
        pdf.ln()
        fill = not fill

    return pdf
