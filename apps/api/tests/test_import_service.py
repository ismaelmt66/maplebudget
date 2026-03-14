"""Unit tests for import service parsing logic (no DB required)."""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_nexledger.db")

from services.import_service import parse_csv, parse_ofx, _parse_date, _detect_csv_columns


class TestDateParsing:
    def test_ymd(self):
        assert _parse_date("2026-01-15") == "2026-01-15"

    def test_mdy(self):
        assert _parse_date("01/15/2026") == "2026-01-15"

    def test_dmy(self):
        assert _parse_date("15/01/2026") == "2026-01-15"

    def test_invalid(self):
        assert _parse_date("not-a-date") is None


class TestCSVColumnDetection:
    def test_standard_headers(self):
        cols = _detect_csv_columns(["Date", "Amount", "Description", "Category"])
        assert "date" in cols
        assert "amount" in cols
        assert "description" in cols
        assert "category" in cols

    def test_french_headers(self):
        cols = _detect_csv_columns(["Date", "Montant", "Libellé"])
        assert "date" in cols
        assert "amount" in cols
        assert "description" in cols

    def test_alternate_headers(self):
        cols = _detect_csv_columns(["Transaction Date", "Value", "Memo"])
        assert "date" in cols
        assert "amount" in cols
        assert "description" in cols


class TestCSVParsing:
    def test_basic_csv(self):
        content = "Date,Amount,Description\n2026-01-15,42.50,Grocery Store\n2026-01-16,15.00,Coffee\n"
        txs, errors = parse_csv(content)
        assert len(txs) == 2
        assert txs[0].amount == 42.50
        assert txs[0].date == "2026-01-15"
        assert len(errors) == 0

    def test_csv_with_currency_symbols(self):
        content = "Date,Amount,Description\n2026-01-15,$42.50,Store\n2026-01-16,€15.00,Shop\n"
        txs, errors = parse_csv(content)
        assert len(txs) == 2
        assert txs[0].amount == 42.50

    def test_csv_with_negative_amounts(self):
        content = "Date,Amount,Description\n2026-01-15,-42.50,Withdrawal\n"
        txs, errors = parse_csv(content)
        assert len(txs) == 1
        assert txs[0].amount == 42.50

    def test_empty_csv(self):
        txs, errors = parse_csv("Date,Amount\n")
        assert len(txs) == 0

    def test_csv_with_bad_date(self):
        content = "Date,Amount,Description\nbaddate,42.50,Store\n"
        txs, errors = parse_csv(content)
        assert len(txs) == 0
        assert len(errors) == 1

    def test_missing_required_columns(self):
        content = "Name,Value\nTest,100\n"
        txs, errors = parse_csv(content)
        assert len(errors) > 0


class TestOFXParsing:
    def test_basic_ofx(self):
        ofx = """<?xml version="1.0"?>
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260115</DTPOSTED>
<TRNAMT>-42.50</TRNAMT>
<FITID>ABC123</FITID>
<NAME>Grocery Store</NAME>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260101</DTPOSTED>
<TRNAMT>5000.00</TRNAMT>
<FITID>DEF456</FITID>
<NAME>Payroll</NAME>
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>"""
        txs, errors = parse_ofx(ofx)
        assert len(txs) == 2
        assert txs[0].amount == 42.50
        assert txs[0].external_id == "ofx-ABC123"
        assert txs[1].amount == 5000.00
