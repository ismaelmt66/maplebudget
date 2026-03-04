// centralise les helpers pour formater les dates et les nombres

const LOCALE = "fr-CA";
const CURRENCY = "CAD";

/**
 * Convert a number to a localized currency string.
 *
 * @param n - value in CAD
 * @returns formatted string like "CA$ 1 234,56"
 */
export function money(n: number): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(n);
}

/**
 * Return an ISO-like date string (YYYY-MM-DD) for a `Date` instance.
 */
export function ymd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse a string produced by {@link ymd} back into a `Date` object.
 */
export function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map((v) => parseInt(v, 10));
  return new Date(y, m - 1, d);
}

/**
 * Return a new Date offset by a number of days. The original object is not
 * modified.
 */
export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Trigger a file download for a generated CSV string.
 * @param filename Name of the file (e.g., 'export.csv')
 * @param csvContent The raw CSV text content
 */
export function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
