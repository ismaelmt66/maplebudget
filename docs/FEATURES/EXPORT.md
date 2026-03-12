# Export Feature — Transactions CSV & PDF

Export your transaction history as a downloadable **CSV** or **PDF** file directly from the Transactions page. You can optionally filter the data before exporting.

---

## User Guide

### How to export

1. Go to **Transactions** in the sidebar.
2. Click the **Export** button (↓ arrow icon) in the top-right of the transaction list.
3. The **Export Transactions** dialog opens.
4. Choose your format: **CSV** or **PDF**.
5. Optionally apply filters (see below).
6. Click **Export CSV** (or **Export PDF**).
7. Your browser will start downloading the file immediately.

### Filter options

| Filter | Description |
|--------|-------------|
| **From date** | Only include transactions on or after this date (YYYY-MM-DD). |
| **To date** | Only include transactions on or before this date (YYYY-MM-DD). |
| **Category** | Restrict the export to a single category. |
| **Min amount** | Only include transactions with amount ≥ this value. |
| **Max amount** | Only include transactions with amount ≤ this value. |

Leaving a filter blank means *no restriction* for that field.

---

## CSV Format

### File encoding

UTF-8 with BOM (byte-order mark) so that Excel opens the file with the correct encoding automatically.

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `ID` | Integer | Database ID of the transaction. |
| `Date` | YYYY-MM-DD | Transaction date. |
| `Category` | String | Category name. |
| `Type` | String | `income` or `expense`. |
| `Amount` | Decimal | Transaction amount. |
| `Note` | String | Optional user note (may be empty). |

### Summary section

The CSV file includes a summary block appended at the end. Lines starting with `#` can be ignored by spreadsheet applications or stripped programmatically.

```
# Summary
# Count,42
# Total,3892.50
# Average,92.68
# Minimum,5.00
# Maximum,450.00
```

### Example

```csv
ID,Date,Category,Type,Amount,Note
12,2024-03-15,Groceries,expense,87.32,Supermarché IGA
11,2024-03-10,Salary,income,2500.00,
10,2024-02-28,Transport,expense,45.00,Monthly transit pass

# Summary
# Count,3
# Total,2632.32
# Average,877.44
# Minimum,45.0
# Maximum,2500.0
```

---

## PDF Format

The PDF export generates a formatted report with:

- **Title** at the top of the first page.
- **Summary box** with count, total, average, and min/max amounts.
- **Transaction table** with alternating row shading for readability.
- **Automatic page breaks** when rows overflow a page.

Notes longer than 30 characters are truncated with `...` to fit the table column.

---

## API Documentation

Both export endpoints are `POST` requests that accept query parameters (no request body required). Authentication via bearer token is required.

### `POST /transactions/export/csv`

Export transactions as a CSV file.

**Query parameters** (all optional):

| Parameter | Type | Description |
|-----------|------|-------------|
| `date_from` | string (YYYY-MM-DD) | Inclusive start date. |
| `date_to` | string (YYYY-MM-DD) | Inclusive end date. |
| `category_id` | integer | Filter to a single category. |
| `amount_min` | float | Minimum amount (inclusive). |
| `amount_max` | float | Maximum amount (inclusive). |

**Response:**

```
Content-Type: text/csv
Content-Disposition: attachment; filename="transactions_2024-01-01_2024-12-31.csv"
```

**Status codes:**

| Code | Meaning |
|------|---------|
| 200 | CSV file returned successfully. |
| 401 | Missing or invalid bearer token. |

**Example (curl):**

```bash
curl -X POST \
  "http://localhost:8000/transactions/export/csv?date_from=2024-01-01&date_to=2024-12-31" \
  -H "Authorization: Bearer <your_token>" \
  --output transactions.csv
```

---

### `POST /transactions/export/pdf`

Export transactions as a PDF report.

**Query parameters:** Same as the CSV endpoint.

**Response:**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="transactions_all_all.pdf"
```

**Status codes:**

| Code | Meaning |
|------|---------|
| 200 | PDF file returned successfully. |
| 401 | Missing or invalid bearer token. |
| 501 | `fpdf2` package is not installed on the server. |

**Example (curl):**

```bash
curl -X POST \
  "http://localhost:8000/transactions/export/pdf?category_id=3" \
  -H "Authorization: Bearer <your_token>" \
  --output transactions.pdf
```

---

## Performance Considerations

- The export is performed **synchronously** in the request handler.  
  For very large datasets (10,000+ transactions) this typically completes in under 5 seconds.
- CSV generation is memory-efficient (uses a `StringIO` buffer).
- PDF generation requires the `fpdf2` package and is slightly slower than CSV for large datasets.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| No transactions match the filters | A valid CSV/PDF is still returned with an empty table and `# Count,0`. |
| `fpdf2` not installed | The PDF endpoint returns `HTTP 501 Not Implemented` with an explanatory message. |
| Invalid token | Both endpoints return `HTTP 401 Unauthorized`. |

---

## Troubleshooting FAQ

**Q: The CSV file looks garbled in Excel.**  
A: Make sure to open the file as UTF-8. The file includes a UTF-8 BOM which Excel should detect automatically. If it doesn't, use *Data → From Text/CSV* and select UTF-8 encoding.

**Q: The PDF export returns a 501 error.**  
A: The `fpdf2` package is not installed. Run `pip install fpdf2` in the API environment.

**Q: The export includes transactions I didn't expect.**  
A: Filters are applied **server-side** on all of your transactions — they are independent of the current filter selection on the Transactions page.

**Q: I want to export only income/expense transactions.**  
A: Use the `category_id` filter to select a category of the desired type. A per-type filter (income/expense) may be added in a future version.
