const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export type Category = { id: number; name: string; type: string };

export type Transaction = {
  id: number;
  amount: number;
  date: string;
  note?: string | null;
  category: Category;
};

export type Dashboard = {
  income_total: number;
  expense_total: number;
  net: number;
  by_category: { category_id: number; name: string; type: string; total: number }[];
};

export async function getCategories(): Promise<Category[]> {
  const r = await fetch(`${API_BASE}/categories`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to load categories");
  return r.json();
}

export async function createCategory(payload: { name: string; type: string }): Promise<Category> {
  const r = await fetch(`${API_BASE}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Failed to create category");
  return r.json();
}

export async function getTransactions(): Promise<Transaction[]> {
  const r = await fetch(`${API_BASE}/transactions`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to load transactions");
  return r.json();
}

export async function createTransaction(payload: {
  amount: number;
  date: string;
  note?: string;
  category_id: number;
}): Promise<Transaction> {
  const r = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Failed to create transaction");
  return r.json();
}

export async function getDashboard(params?: { from_date?: string; to_date?: string }): Promise<Dashboard> {
  const qs = new URLSearchParams();
  if (params?.from_date) qs.set("from_date", params.from_date);
  if (params?.to_date) qs.set("to_date", params.to_date);

  const url = `${API_BASE}/dashboard${qs.toString() ? `?${qs.toString()}` : ""}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to load dashboard");
  return r.json();
}
export async function exportTransactionsCSV(): Promise<string> {
  const r = await fetch(`${API_BASE}/transactions/export`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to export CSV");
  return r.text();
}