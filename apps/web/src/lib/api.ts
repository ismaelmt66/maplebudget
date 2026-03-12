/**
 * Core API client for NexLeger.
 * Handles authentication headers, error parsing, and type definitions.
 */
import { getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

/** Custom error class representing an HTTP error from the API */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Internal fetch wrapper that automatically attaches the bearer token
 * and handles JSON parsing. Throws `ApiError` on non-2xx responses.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
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

export type Category = { id: number; name: string; type: string; budget_limit?: number | null; };

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

export async function createCategory(payload: { name: string; type: string; budget_limit?: number | null }): Promise<Category> {
  return apiFetch("/categories", { method: "POST", body: JSON.stringify(payload) }) as Promise<Category>;
}

export async function updateCategory(
  id: number,
  payload: { name?: string; type?: string; budget_limit?: number | null }
): Promise<Category> {
  return apiFetch(`/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) }) as Promise<Category>;
}

export async function deleteCategory(id: number): Promise<{ deleted: boolean; id: number }> {
  return apiFetch(`/categories/${id}`, { method: "DELETE" }) as Promise<{ deleted: boolean; id: number }>;
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

export type Subscription = {
  name: string;
  monthly_cost: number;
  yearly_projection: number;
  status: string;
  has_price_hike: boolean;
  category_name: string;
  last_date: string;
};

export async function getSubscriptions(): Promise<Subscription[]> {
  return apiFetch("/analytics/subscriptions") as Promise<Subscription[]>;
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

/* ---------- Assets (Patrimoine) ---------- */

export type AssetHistory = {
  id: number;
  asset_id: number;
  date: string;
  balance: number;
}

export type Asset = {
  id: number;
  name: string;
  type: string;
  balance: number;
  history: AssetHistory[];
};

export async function getAssets(): Promise<Asset[]> {
  return apiFetch("/assets") as Promise<Asset[]>;
}

export async function createAsset(payload: {
  name: string;
  type: string;
  balance: number;
}): Promise<Asset> {
  return apiFetch("/assets", { method: "POST", body: JSON.stringify(payload) }) as Promise<Asset>;
}

export async function updateAsset(
  id: number,
  payload: { name?: string; type?: string; balance?: number }
): Promise<Asset> {
  return apiFetch(`/assets/${id}`, { method: "PUT", body: JSON.stringify(payload) }) as Promise<Asset>;
}

export async function deleteAsset(id: number): Promise<{ deleted: boolean; id: number }> {
  return apiFetch(`/assets/${id}`, { method: "DELETE" }) as Promise<{ deleted: boolean; id: number }>;
}

/* ---------- Gamification / Achievements ---------- */

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  is_unlocked: boolean;
  progress: number;
  unlock_date?: string;
};

export async function getAchievements(): Promise<Achievement[]> {
  return apiFetch("/achievements") as Promise<Achievement[]>;
}

/* ---------- AI Coach ---------- */

export async function sendChatMessage(message: string): Promise<{ reply: string }> {
  return apiFetch("/ai/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  }) as Promise<{ reply: string }>;
}

/* ---------- Smart Allocation Rules ---------- */

export type AllocationRule = {
  id: number;
  name: string;
  source_type: "all_income" | "category";
  source_category_id?: number | null;
  source_category_name?: string | null;
  target_asset_id: number;
  target_asset_name: string;
  allocation_percent: number;
  is_active: boolean;
};

export type AllocationSimulateResult = {
  rule_id: number;
  rule_name: string;
  target_asset_name: string;
  allocated_amount: number;
  percent: number;
};

export type ApplyResult = {
  applied: { rule_name: string; asset_name: string; allocated_amount: number; new_balance: number }[];
  count: number;
  total_allocated: number;
};

export async function getAllocationRules(): Promise<AllocationRule[]> {
  return apiFetch("/assets/allocation-rules") as Promise<AllocationRule[]>;
}

export async function createAllocationRule(payload: {
  name: string;
  source_type: string;
  source_category_id?: number | null;
  target_asset_id: number;
  allocation_percent: number;
}): Promise<AllocationRule> {
  return apiFetch("/assets/allocation-rules", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<AllocationRule>;
}

export async function updateAllocationRule(
  id: number,
  payload: Partial<{ name: string; source_type: string; source_category_id: number | null; target_asset_id: number; allocation_percent: number; is_active: boolean }>
): Promise<AllocationRule> {
  return apiFetch(`/assets/allocation-rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }) as Promise<AllocationRule>;
}

export async function deleteAllocationRule(id: number): Promise<void> {
  await apiFetch(`/assets/allocation-rules/${id}`, { method: "DELETE" });
}

export async function simulateAllocation(income_amount: number): Promise<AllocationSimulateResult[]> {
  return apiFetch("/assets/allocation-rules/simulate", {
    method: "POST",
    body: JSON.stringify({ income_amount }),
  }) as Promise<AllocationSimulateResult[]>;
}

export async function applyAllocation(income_amount: number, income_category_id?: number): Promise<ApplyResult> {
  return apiFetch("/assets/allocation-rules/apply", {
    method: "POST",
    body: JSON.stringify({ income_amount, income_category_id }),
  }) as Promise<ApplyResult>;
}

export async function getPatrimoineAIAnalysis(): Promise<{ report: string }> {
  return apiFetch("/assets/ai-analysis") as Promise<{ report: string }>;
}

/* ---------- Budget Alerts ---------- */

export type BudgetAlert = {
  category_id: number;
  category_name: string;
  budget_limit: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: "safe" | "warning" | "danger" | "exceeded";
};

export type BudgetAlertResponse = {
  alerts: BudgetAlert[];
  total_budget: number;
  total_spent: number;
  month: string;
};

export type BudgetSummary = {
  total_budget: number;
  total_spent: number;
  remaining: number;
  over_budget_count: number;
  warning_count: number;
  month: string;
};

export async function getBudgetAlerts(): Promise<BudgetAlertResponse> {
  return apiFetch("/budget/alerts") as Promise<BudgetAlertResponse>;
}

export async function getBudgetSummary(): Promise<BudgetSummary> {
  return apiFetch("/budget/summary") as Promise<BudgetSummary>;
}

export type RecurringTransaction = {
  id: number;
  name: string;
  amount: number;
  frequency: string;
  next_occurrence: string | null;
  last_occurrence: string | null;
  status: string;
  confidence_score: number;
  category_name: string | null;
  created_at: string;
  updated_at: string;
};

export async function getRecurringTransactions(): Promise<RecurringTransaction[]> {
  return apiFetch("/transactions/recurring") as Promise<RecurringTransaction[]>;
}

export async function createRecurringTransaction(payload: {
  name: string;
  amount: number;
  frequency: string;
  next_occurrence?: string | null;
  category_name?: string | null;
}): Promise<RecurringTransaction> {
  return apiFetch("/transactions/recurring", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<RecurringTransaction>;
}

export async function detectRecurringTransactions(): Promise<RecurringTransaction[]> {
  return apiFetch("/transactions/detect-recurring", {
    method: "POST",
  }) as Promise<RecurringTransaction[]>;
}

export async function updateRecurringTransaction(
  id: number,
  payload: {
    name?: string;
    amount?: number;
    frequency?: string;
    next_occurrence?: string | null;
    status?: string;
  }
): Promise<RecurringTransaction> {
  return apiFetch(`/transactions/recurring/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }) as Promise<RecurringTransaction>;
}

export async function deleteRecurringTransaction(id: number): Promise<{ deleted: boolean; id: number }> {
  return apiFetch(`/transactions/recurring/${id}`, { method: "DELETE" }) as Promise<{ deleted: boolean; id: number }>;
}
