// apps/web/src/lib/api.ts
import { getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);

  // JSON par défaut si body stringifié
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Ajout token si présent
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const msg =
      res.status === 401
        ? "Unauthorized (401) — connecte-toi d'abord."
        : text || `HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }

  // JSON ou texte
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

/* ---------- Types ---------- */
export type User = { id: number; email: string };

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
  tx_count: number;
  by_category: { category_id: number; name: string; type: string; total: number; count: number }[];
};

/* ---------- Auth ---------- */
export async function registerUser(payload: { email: string; password: string }): Promise<User> {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<User>;
}

// OAuth2PasswordRequestForm => x-www-form-urlencoded
export async function loginUser(payload: { email: string; password: string }): Promise<{ access_token: string; token_type: string }> {
  const body = new URLSearchParams();
  body.set("username", payload.email);
  body.set("password", payload.password);

  const res = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const msg = res.status === 401 ? "Email ou mot de passe incorrect." : text || `HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }

  return res.json();
}

export async function me(): Promise<User> {
  return apiFetch("/auth/me") as Promise<User>;
}

/* ---------- Categories ---------- */
export async function getCategories(): Promise<Category[]> {
  return apiFetch("/categories") as Promise<Category[]>;
}

export async function createCategory(payload: { name: string; type: string }): Promise<Category> {
  return apiFetch("/categories", { method: "POST", body: JSON.stringify(payload) }) as Promise<Category>;
}

/* ---------- Transactions ---------- */
export async function getTransactions(): Promise<Transaction[]> {
  return apiFetch("/transactions") as Promise<Transaction[]>;
}

export async function createTransaction(payload: {
  amount: number;
  date: string;
  note?: string;
  category_id: number;
}): Promise<Transaction> {
  return apiFetch("/transactions", { method: "POST", body: JSON.stringify(payload) }) as Promise<Transaction>;
}

export async function updateTransaction(
  id: number,
  payload: { amount?: number; date?: string; note?: string; category_id?: number }
): Promise<Transaction> {
  return apiFetch(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(payload) }) as Promise<Transaction>;
}

export async function deleteTransaction(id: number): Promise<{ deleted: boolean; id: number }> {
  return apiFetch(`/transactions/${id}`, { method: "DELETE" }) as Promise<{ deleted: boolean; id: number }>;
}

/* ---------- Dashboard ---------- */
export async function getDashboard(params?: { from_date?: string; to_date?: string }): Promise<Dashboard> {
  const qs = new URLSearchParams();
  if (params?.from_date) qs.set("from_date", params.from_date);
  if (params?.to_date) qs.set("to_date", params.to_date);

  const url = `/dashboard${qs.toString() ? `?${qs.toString()}` : ""}`;
  return apiFetch(url) as Promise<Dashboard>;
}

export type Goal = {
  id: number;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date: string; // YYYY-MM-DD
};

export type GoalPlan = {
  goal_id: number;
  months_remaining: number;
  monthly_required: number;
  current_amount: number;
  target_amount: number;
  target_date: string;
};

export async function getGoals(): Promise<Goal[]> {
  return apiFetch("/goals") as Promise<Goal[]>;
}

export async function createGoal(payload: {
  title: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
}): Promise<Goal> {
  return apiFetch("/goals", { method: "POST", body: JSON.stringify(payload) }) as Promise<Goal>;
}

export async function getGoalPlan(goalId: number): Promise<GoalPlan> {
  return apiFetch(`/goals/${goalId}/plan`) as Promise<GoalPlan>;
}

export async function updateGoal(
  goalId: number,
  payload: { title?: string; target_amount?: number; current_amount?: number; target_date?: string }
): Promise<Goal> {
  return apiFetch(`/goals/${goalId}`, { method: "PUT", body: JSON.stringify(payload) }) as Promise<Goal>;
}

export async function deleteGoal(goalId: number): Promise<{ deleted: boolean; id: number }> {
  return apiFetch(`/goals/${goalId}`, { method: "DELETE" }) as Promise<{ deleted: boolean; id: number }>;
}