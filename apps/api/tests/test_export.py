"""Unit tests for the ExportService (CSV & PDF generation).

Run with:
    cd apps/api && pip install -r requirements.txt pytest
    pytest tests/test_export.py -v
"""

from __future__ import annotations

import csv
import io
import sys
import os

# Allow imports from the api package root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.export_service import (
    ExportFilters,
    ExportService,
    SummaryStats,
    _apply_filters,
    _compute_summary,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def make_tx(
    id_: int = 1,
    date: str = "2024-01-15",
    amount: float = 100.0,
    note: str = "",
    category_id: int = 1,
    category_name: str = "Food",
    category_type: str = "expense",
) -> dict:
    return {
        "id": id_,
        "date": date,
        "amount": amount,
        "note": note,
        "category_id": category_id,
        "category_name": category_name,
        "category_type": category_type,
    }


def sample_transactions(n: int = 5) -> list[dict]:
    categories = [
        (1, "Food", "expense"),
        (2, "Salary", "income"),
        (3, "Transport", "expense"),
        (4, "Entertainment", "expense"),
        (5, "Freelance", "income"),
    ]
    txs = []
    for i in range(n):
        cat_id, cat_name, cat_type = categories[i % len(categories)]
        txs.append(
            make_tx(
                id_=i + 1,
                date=f"2024-{(i % 12) + 1:02d}-{(i % 28) + 1:02d}",
                amount=round(50.0 + i * 23.5, 2),
                note=f"note {i}" if i % 3 == 0 else "",
                category_id=cat_id,
                category_name=cat_name,
                category_type=cat_type,
            )
        )
    return txs


SERVICE = ExportService()


# ---------------------------------------------------------------------------
# _apply_filters
# ---------------------------------------------------------------------------


class TestApplyFilters:
    def test_no_filter_returns_all(self):
        txs = sample_transactions(10)
        result = _apply_filters(txs, ExportFilters())
        assert len(result) == 10

    def test_date_from_filter(self):
        txs = [
            make_tx(id_=1, date="2024-01-01"),
            make_tx(id_=2, date="2024-06-15"),
            make_tx(id_=3, date="2024-12-31"),
        ]
        result = _apply_filters(txs, ExportFilters(date_from="2024-06-01"))
        assert len(result) == 2
        assert all(t["date"] >= "2024-06-01" for t in result)

    def test_date_to_filter(self):
        txs = [
            make_tx(id_=1, date="2024-01-01"),
            make_tx(id_=2, date="2024-06-15"),
            make_tx(id_=3, date="2024-12-31"),
        ]
        result = _apply_filters(txs, ExportFilters(date_to="2024-06-30"))
        assert len(result) == 2
        assert all(t["date"] <= "2024-06-30" for t in result)

    def test_date_range_filter(self):
        txs = [
            make_tx(id_=1, date="2024-01-01"),
            make_tx(id_=2, date="2024-03-15"),
            make_tx(id_=3, date="2024-06-30"),
            make_tx(id_=4, date="2024-12-31"),
        ]
        result = _apply_filters(txs, ExportFilters(date_from="2024-02-01", date_to="2024-07-01"))
        assert len(result) == 2

    def test_category_id_filter(self):
        txs = [
            make_tx(id_=1, category_id=1),
            make_tx(id_=2, category_id=2),
            make_tx(id_=3, category_id=1),
        ]
        result = _apply_filters(txs, ExportFilters(category_id=1))
        assert len(result) == 2
        assert all(t["category_id"] == 1 for t in result)

    def test_amount_min_filter(self):
        txs = [
            make_tx(id_=1, amount=10.0),
            make_tx(id_=2, amount=50.0),
            make_tx(id_=3, amount=200.0),
        ]
        result = _apply_filters(txs, ExportFilters(amount_min=50.0))
        assert len(result) == 2

    def test_amount_max_filter(self):
        txs = [
            make_tx(id_=1, amount=10.0),
            make_tx(id_=2, amount=50.0),
            make_tx(id_=3, amount=200.0),
        ]
        result = _apply_filters(txs, ExportFilters(amount_max=50.0))
        assert len(result) == 2

    def test_amount_range_filter(self):
        txs = [
            make_tx(id_=1, amount=10.0),
            make_tx(id_=2, amount=50.0),
            make_tx(id_=3, amount=75.0),
            make_tx(id_=4, amount=200.0),
        ]
        result = _apply_filters(txs, ExportFilters(amount_min=40.0, amount_max=100.0))
        assert len(result) == 2

    def test_combined_filters(self):
        txs = [
            make_tx(id_=1, date="2024-01-01", amount=100.0, category_id=1),
            make_tx(id_=2, date="2024-03-01", amount=50.0, category_id=1),
            make_tx(id_=3, date="2024-03-01", amount=100.0, category_id=2),
            make_tx(id_=4, date="2024-03-01", amount=200.0, category_id=1),
        ]
        result = _apply_filters(
            txs,
            ExportFilters(
                date_from="2024-02-01",
                category_id=1,
                amount_max=150.0,
            ),
        )
        assert len(result) == 1
        assert result[0]["id"] == 2

    def test_empty_input_returns_empty(self):
        result = _apply_filters([], ExportFilters(date_from="2024-01-01"))
        assert result == []

    def test_no_match_returns_empty(self):
        txs = [make_tx(amount=10.0)]
        result = _apply_filters(txs, ExportFilters(amount_min=500.0))
        assert result == []


# ---------------------------------------------------------------------------
# _compute_summary
# ---------------------------------------------------------------------------


class TestComputeSummary:
    def test_empty_list(self):
        s = _compute_summary([])
        assert s == SummaryStats(count=0, total=0.0, average=0.0, minimum=0.0, maximum=0.0)

    def test_single_transaction(self):
        s = _compute_summary([make_tx(amount=42.0)])
        assert s.count == 1
        assert s.total == 42.0
        assert s.average == 42.0
        assert s.minimum == 42.0
        assert s.maximum == 42.0

    def test_multiple_transactions(self):
        txs = [make_tx(amount=a) for a in [10.0, 20.0, 30.0]]
        s = _compute_summary(txs)
        assert s.count == 3
        assert s.total == 60.0
        assert s.average == 20.0
        assert s.minimum == 10.0
        assert s.maximum == 30.0

    def test_rounding(self):
        txs = [make_tx(amount=a) for a in [1.1, 2.2, 3.3]]
        s = _compute_summary(txs)
        assert s.total == round(6.6, 2)

    def test_large_dataset(self):
        txs = [make_tx(amount=1.0) for _ in range(1000)]
        s = _compute_summary(txs)
        assert s.count == 1000
        assert s.total == 1000.0


# ---------------------------------------------------------------------------
# ExportService.generate_csv
# ---------------------------------------------------------------------------


class TestGenerateCsv:
    def test_csv_all_transactions(self):
        txs = sample_transactions(5)
        result = SERVICE.generate_csv(txs)
        text = result.decode("utf-8-sig")  # strip BOM
        lines = text.strip().splitlines()
        # Header + 5 data rows + empty + summary rows
        assert lines[0] == "ID,Date,Category,Type,Amount,Note"
        assert len([line for line in lines if not line.startswith("#") and line]) == 6  # header + 5 rows

    def test_csv_is_bytes(self):
        result = SERVICE.generate_csv([])
        assert isinstance(result, bytes)

    def test_csv_utf8_bom(self):
        result = SERVICE.generate_csv([])
        assert result.startswith(b"\xef\xbb\xbf")

    def test_csv_with_date_filter(self):
        txs = [
            make_tx(id_=1, date="2024-01-01"),
            make_tx(id_=2, date="2024-06-01"),
            make_tx(id_=3, date="2024-12-01"),
        ]
        result = SERVICE.generate_csv(txs, ExportFilters(date_from="2024-05-01"))
        text = result.decode("utf-8-sig")
        rows = [ln for ln in text.splitlines() if ln and not ln.startswith("#")]
        # header + 2 data rows
        assert len(rows) == 3

    def test_csv_with_category_filter(self):
        txs = [
            make_tx(id_=1, category_id=1, category_name="Food"),
            make_tx(id_=2, category_id=2, category_name="Salary"),
            make_tx(id_=3, category_id=1, category_name="Food"),
        ]
        result = SERVICE.generate_csv(txs, ExportFilters(category_id=1))
        text = result.decode("utf-8-sig")
        rows = [ln for ln in text.splitlines() if ln and not ln.startswith("#")]
        assert len(rows) == 3  # header + 2 Food rows

    def test_csv_with_amount_filter(self):
        txs = [
            make_tx(id_=1, amount=10.0),
            make_tx(id_=2, amount=200.0),
        ]
        result = SERVICE.generate_csv(txs, ExportFilters(amount_max=100.0))
        text = result.decode("utf-8-sig")
        rows = [ln for ln in text.splitlines() if ln and not ln.startswith("#")]
        assert len(rows) == 2  # header + 1 row

    def test_csv_empty_result(self):
        txs = [make_tx(amount=10.0)]
        result = SERVICE.generate_csv(txs, ExportFilters(amount_min=500.0))
        text = result.decode("utf-8-sig")
        rows = [ln for ln in text.splitlines() if ln and not ln.startswith("#")]
        assert len(rows) == 1  # header only

    def test_csv_large_dataset(self):
        """10 000 transactions should export without error."""
        txs = [make_tx(id_=i, amount=float(i)) for i in range(1, 10001)]
        result = SERVICE.generate_csv(txs)
        assert isinstance(result, bytes)
        text = result.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(text))
        data_rows = [r for r in reader if r and not r[0].startswith("#")]
        assert len(data_rows) == 10001  # header + 10000 rows

    def test_csv_includes_summary(self):
        txs = [make_tx(amount=100.0), make_tx(amount=200.0)]
        result = SERVICE.generate_csv(txs)
        text = result.decode("utf-8-sig")
        assert "# Summary" in text
        assert "# Count" in text
        assert "# Total" in text

    def test_csv_summary_values_correct(self):
        txs = [make_tx(amount=100.0), make_tx(amount=200.0)]
        result = SERVICE.generate_csv(txs)
        text = result.decode("utf-8-sig")
        assert "# Count,2" in text
        assert "# Total,300.0" in text

    def test_csv_special_characters(self):
        txs = [make_tx(note='Café "Montréal"')]
        result = SERVICE.generate_csv(txs)
        text = result.decode("utf-8-sig")
        assert "Caf" in text

    def test_csv_unicode_handling(self):
        txs = [make_tx(category_name="食費", note="東京")]
        result = SERVICE.generate_csv(txs)
        text = result.decode("utf-8-sig")
        assert "食費" in text
        assert "東京" in text

    def test_csv_no_filter_returns_all(self):
        txs = sample_transactions(20)
        result = SERVICE.generate_csv(txs)
        text = result.decode("utf-8-sig")
        data_rows = [
            ln for ln in text.splitlines()
            if ln and not ln.startswith("#")
        ]
        # header + 20 rows
        assert len(data_rows) == 21

    def test_csv_column_order(self):
        txs = [make_tx()]
        result = SERVICE.generate_csv(txs)
        text = result.decode("utf-8-sig")
        header = text.splitlines()[0]
        assert header == "ID,Date,Category,Type,Amount,Note"

    def test_csv_amount_precision(self):
        txs = [make_tx(amount=1.005)]
        result = SERVICE.generate_csv(txs)
        text = result.decode("utf-8-sig")
        assert "1.005" in text

    def test_csv_empty_note(self):
        txs = [make_tx(note="")]
        result = SERVICE.generate_csv(txs)
        text = result.decode("utf-8-sig")
        # Should not raise and the row should have an empty note field
        rows = [ln for ln in text.splitlines() if ln and not ln.startswith("#")]
        assert len(rows) == 2  # header + data


# ---------------------------------------------------------------------------
# ExportService.generate_pdf
# ---------------------------------------------------------------------------


class TestGeneratePdf:
    def test_pdf_returns_bytes(self):
        txs = sample_transactions(3)
        result = SERVICE.generate_pdf(txs)
        assert isinstance(result, bytes)

    def test_pdf_starts_with_header(self):
        result = SERVICE.generate_pdf([])
        # PDF magic bytes
        assert result[:4] == b"%PDF"

    def test_pdf_basic(self):
        txs = sample_transactions(5)
        result = SERVICE.generate_pdf(txs, title="Test Export")
        assert len(result) > 100

    def test_pdf_empty_transactions(self):
        result = SERVICE.generate_pdf([])
        assert isinstance(result, bytes)
        assert result[:4] == b"%PDF"

    def test_pdf_with_date_filter(self):
        txs = [
            make_tx(id_=1, date="2024-01-01"),
            make_tx(id_=2, date="2024-06-01"),
        ]
        result = SERVICE.generate_pdf(txs, ExportFilters(date_from="2024-05-01"))
        assert isinstance(result, bytes)

    def test_pdf_large_dataset(self):
        """100 transactions should fit in a multi-page PDF."""
        txs = [make_tx(id_=i, amount=float(i)) for i in range(1, 101)]
        result = SERVICE.generate_pdf(txs)
        assert isinstance(result, bytes)
        assert len(result) > 500

    def test_pdf_unicode_handling(self):
        txs = [make_tx(category_name="Épicerie", note="Montréal")]
        # Should not raise for Latin-extended characters
        result = SERVICE.generate_pdf(txs)
        assert result[:4] == b"%PDF"

    def test_pdf_custom_title(self):
        result = SERVICE.generate_pdf([], title="My Custom Report")
        assert isinstance(result, bytes)

    def test_pdf_with_summary(self):
        txs = [make_tx(amount=100.0), make_tx(amount=200.0)]
        result = SERVICE.generate_pdf(txs)
        assert isinstance(result, bytes)

    def test_pdf_long_note_truncated(self):
        long_note = "x" * 100
        txs = [make_tx(note=long_note)]
        # Should not raise even with very long notes
        result = SERVICE.generate_pdf(txs)
        assert isinstance(result, bytes)


# ---------------------------------------------------------------------------
# ExportService static helpers exposed publicly
# ---------------------------------------------------------------------------


class TestExportServicePublicHelpers:
    def test_apply_filters_wrapper(self):
        txs = [make_tx(amount=10.0), make_tx(amount=200.0)]
        result = ExportService.apply_filters(txs, ExportFilters(amount_min=100.0))
        assert len(result) == 1

    def test_compute_summary_wrapper(self):
        txs = [make_tx(amount=50.0), make_tx(amount=150.0)]
        s = ExportService.compute_summary(txs)
        assert s.count == 2
        assert s.total == 200.0
