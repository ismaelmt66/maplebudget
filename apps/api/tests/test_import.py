"""Tests for CSV and OFX import functionality."""

import io
from tests.conftest import *  # noqa: F401, F403


class TestCSVImport:
    def _create_category(self, client, headers):
        resp = client.post("/categories", json={"name": "Import", "type": "expense"}, headers=headers)
        return resp.json()["id"]

    def test_csv_import(self, client, auth_headers):
        self._create_category(client, auth_headers)
        csv_content = "Date,Amount,Description\n2026-01-15,42.50,Grocery Store\n2026-01-16,15.00,Coffee Shop\n"
        resp = client.post("/import/csv",
            files={"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported"] == 2

    def test_csv_preview(self, client, auth_headers):
        csv_content = "Date,Amount,Description\n2026-01-15,42.50,Grocery Store\n"
        resp = client.post("/import/preview/csv",
            files={"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert len(data["preview"]) == 1

    def test_csv_deduplication(self, client, auth_headers):
        self._create_category(client, auth_headers)
        csv_content = "Date,Amount,Description\n2026-01-15,42.50,Grocery Store\n"
        client.post("/import/csv",
            files={"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")},
            headers=auth_headers,
        )
        resp = client.post("/import/csv",
            files={"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")},
            headers=auth_headers,
        )
        data = resp.json()
        assert data["skipped"] == 1
        assert data["imported"] == 0

    def test_invalid_file_type(self, client, auth_headers):
        resp = client.post("/import/csv",
            files={"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")},
            headers=auth_headers,
        )
        assert resp.status_code == 400


class TestOFXImport:
    def _create_category(self, client, headers):
        resp = client.post("/categories", json={"name": "Import", "type": "expense"}, headers=headers)
        return resp.json()["id"]

    def test_ofx_import(self, client, auth_headers):
        self._create_category(client, auth_headers)
        ofx_content = """<?xml version="1.0" encoding="UTF-8"?>
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260115</DTPOSTED>
<TRNAMT>-42.50</TRNAMT>
<FITID>TXN001</FITID>
<NAME>Grocery Store</NAME>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>"""
        resp = client.post("/import/ofx",
            files={"file": ("test.ofx", io.BytesIO(ofx_content.encode()), "application/octet-stream")},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported"] == 1

    def test_invalid_ofx_extension(self, client, auth_headers):
        resp = client.post("/import/ofx",
            files={"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")},
            headers=auth_headers,
        )
        assert resp.status_code == 400
