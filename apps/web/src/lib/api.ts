const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export type Category = { id: number; name: string; type: string };
export type Transaction = {
  id: number;
  amount: number;
  date: string;
  note?: string | null;
  category: Category;
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
