/**
 * Core API client for NexLedger.
 * Handles authentication headers, error parsing, and type definitions.
 */
import { getToken } from "@/lib/auth";

let API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
if (typeof window !== "undefined") {
  API_BASE = `http://${window.location.hostname}:8000`;
}

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
  is_recurring?: boolean;
  recurrence_interval?: string | null;
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

export async function getOnboardingStatus(): Promise<{ is_onboarded: boolean }> {
  return apiFetch("/auth/onboarding-status") as Promise<{ is_onboarded: boolean }>;
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

export async function downloadTransactionsCSV(options?: { from_date?: string; to_date?: string }): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const qs = new URLSearchParams();
  if (options?.from_date) qs.set("from_date", options.from_date);
  if (options?.to_date) qs.set("to_date", options.to_date);

  const base = typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000");

  const url = `${base}/transactions/export/csv${qs.toString() ? `?${qs.toString()}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Export CSV échoué (${response.status})`);

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `nexledger_transactions${options?.from_date ? `_${options.from_date}` : ""}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export async function createTransaction(payload: {
  amount: number;
  date: string;
  note?: string;
  category_id: number;
  is_recurring?: boolean;
  recurrence_interval?: string | null;
}): Promise<Transaction> {
  return apiFetch("/transactions", { method: "POST", body: JSON.stringify(payload) }) as Promise<Transaction>;
}

export async function processRecurringTransactions(): Promise<{ generated: object[]; count: number }> {
  return apiFetch("/transactions/process-recurring", { method: "POST" }) as Promise<{ generated: object[]; count: number }>;
}

export async function suggestCategory(description: string): Promise<{ category_id: number | null; category_name: string; confidence: number }> {
  return apiFetch("/transactions/suggest-category", {
    method: "POST",
    body: JSON.stringify({ description }),
  }) as Promise<{ category_id: number | null; category_name: string; confidence: number }>;
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

export type AIStatus = {
  mode: "llm" | "heuristic";
  llm_provider: "groq" | "anthropic" | null;
};

export async function getAIStatus(): Promise<AIStatus> {
  return apiFetch("/ai/status") as Promise<AIStatus>;
}

export async function sendChatMessage(message: string, history?: {role: string; content: string}[]): Promise<{ reply: string }> {
  return apiFetch("/ai/chat", {
    method: "POST",
    body: JSON.stringify(history ? { message, history } : { message }),
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
  id: number;
  category_id: number;
  category_name: string;
  monthly_limit: number;
  created_at: string;
  // enriched fields (from /budget-alerts/check join)
  status?: "safe" | "warning" | "danger" | "exceeded";
  percentage?: number;
  spent?: number;
  budget_limit?: number;
  remaining?: number;
};

export type BudgetAlertCheck = {
  category_id: number;
  category_name: string;
  monthly_limit: number;
  current_spending: number;
  percentage: number;
  is_exceeded: boolean;
};

export async function getBudgetAlerts(): Promise<BudgetAlert[]> {
  return apiFetch("/budget-alerts") as Promise<BudgetAlert[]>;
}

export async function createBudgetAlert(payload: { category_id: number; monthly_limit: number }): Promise<BudgetAlert> {
  return apiFetch("/budget-alerts", { method: "POST", body: JSON.stringify(payload) }) as Promise<BudgetAlert>;
}

export async function deleteBudgetAlert(id: number): Promise<void> {
  await apiFetch(`/budget-alerts/${id}`, { method: "DELETE" });
}

export async function checkBudgetAlerts(): Promise<BudgetAlertCheck[]> {
  return apiFetch("/budget-alerts/check") as Promise<BudgetAlertCheck[]>;
}

/* ---------- Financial Health Score ---------- */

export type HealthScore = {
  score: number;
  grade: string;
  label?: string;
  color?: string;
  breakdown: {
    savings_rate: number;
    budget_compliance: number;
    budget_adherence?: number;
    emergency_fund: number;
    goal_progress: number;
    goals_progress?: number;
    diversification: number;
  };
  insights: string[];
  recommendations?: string[];
  last_calculated: string;
};

export async function getFinancialHealthScore(): Promise<HealthScore> {
  return apiFetch("/financial-health-score") as Promise<HealthScore>;
}

// Alias attendu par HealthScoreGauge.tsx
export type HealthScoreResponse = HealthScore;
export async function getHealthScore(): Promise<HealthScoreResponse> {
  return apiFetch("/financial-health-score") as Promise<HealthScoreResponse>;
}

/* ---------- Global Search ---------- */

export type SearchResults = {
  transactions: { id: number; date: string; amount: number; note?: string; category_name: string; category_type: string }[];
  categories: { id: number; name: string; type: string }[];
  goals: { id: number; title: string; target_amount: number; current_amount: number }[];
};

export async function globalSearch(q: string): Promise<SearchResults> {
  return apiFetch(`/search?q=${encodeURIComponent(q)}`) as Promise<SearchResults>;
}

/* ---------- Notifications Proactives ---------- */

export type Notification = {
  id: number;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

export async function getNotifications(): Promise<Notification[]> {
  return apiFetch("/notifications") as Promise<Notification[]>;
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiFetch(`/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch("/notifications/read-all", { method: "POST" });
}

/* ---------- Rapport Hebdomadaire ---------- */

export type WeeklyReport = {
  id: number;
  week_start: string;
  content: string;
  created_at: string;
};

export async function getWeeklyReport(): Promise<WeeklyReport> {
  return apiFetch("/reports/weekly") as Promise<WeeklyReport>;
}

/* ---------- Simulateur "Et si..." ---------- */

export type SimulatorProjection = {
  year: number;
  baseline: number;
  optimized: number;
  difference: number;
};

export type SimulatorResult = {
  projections: SimulatorProjection[];
  total_saved_extra: number;
  monthly_gain: number;
  summary: string;
};

export async function simulateProjection(payload: {
  monthly_savings_extra?: number;
  expense_cuts?: { label: string; monthly_amount: number }[];
  years?: number;
  expected_return?: number;
}): Promise<SimulatorResult> {
  return apiFetch("/simulator/projection", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<SimulatorResult>;
}

/* ---------- BudgetAlert (extended — pour BudgetAlertCard/budget page) ---------- */

// Override the base BudgetAlert with richer fields from /budget-alerts/check
declare module "@/lib/api" {}

export type BudgetAlertResponse = {
  alerts: BudgetAlert[];
  total_budget: number;
  total_spent: number;
  over_budget_count: number;
  warning_count: number;
  month?: string;
};

export async function getBudgetAlertsFull(): Promise<BudgetAlertResponse> {
  const [alerts, checks] = await Promise.all([
    apiFetch("/budget-alerts") as Promise<BudgetAlert[]>,
    apiFetch("/budget-alerts/check") as Promise<BudgetAlertCheck[]>,
  ]);
  const checkMap = new Map(checks.map(c => [c.category_id, c]));
  const enriched = alerts.map(a => {
    const c = checkMap.get(a.category_id);
    const pct = c?.percentage ?? 0;
    const spent = c?.current_spending ?? 0;
    const limit = a.monthly_limit;
    const remaining = limit - spent;
    const status: "safe" | "warning" | "danger" | "exceeded" =
      pct >= 100 ? "exceeded" : pct >= 90 ? "danger" : pct >= 75 ? "warning" : "safe";
    return { ...a, status, percentage: pct, spent, budget_limit: limit, remaining };
  });
  const over = enriched.filter(a => a.status === "exceeded").length;
  const warning = enriched.filter(a => a.status === "warning" || a.status === "danger").length;
  return {
    alerts: enriched,
    total_budget: enriched.reduce((s, a) => s + a.budget_limit, 0),
    total_spent: enriched.reduce((s, a) => s + a.spent, 0),
    over_budget_count: over,
    warning_count: warning,
  };
}


/* ---------- Budget Summary (pour BudgetAlertBanner) ---------- */

export type BudgetSummary = {
  total_alerts: number;
  over_budget_count: number;
  warning_count: number;
  total_budget: number;
  total_spent: number;
};

export async function getBudgetSummary(): Promise<BudgetSummary> {
  return apiFetch("/budget-alerts/summary") as Promise<BudgetSummary>;
}

/* ---------- Recurring Transactions ---------- */

export type RecurringTransaction = {
  id: number;
  name: string;
  amount: number;
  frequency: string;
  next_date: string;
  next_occurrence?: string;
  last_occurrence?: string | null;
  note?: string;
  is_active: boolean;
  status?: "active" | "paused" | "ended";
  category_id: number;
  category_name?: string;
  user_id: number;
  confidence_score?: number;
};

export async function getRecurringTransactions(): Promise<RecurringTransaction[]> {
  return apiFetch("/recurring-transactions") as Promise<RecurringTransaction[]>;
}

export async function createRecurringTransaction(payload: Partial<RecurringTransaction>): Promise<RecurringTransaction> {
  return apiFetch("/recurring-transactions", { method: "POST", body: JSON.stringify(payload) }) as Promise<RecurringTransaction>;
}

export async function updateRecurringTransaction(id: number, payload: Partial<RecurringTransaction>): Promise<RecurringTransaction> {
  return apiFetch(`/recurring-transactions/${id}`, { method: "PUT", body: JSON.stringify(payload) }) as Promise<RecurringTransaction>;
}

export async function deleteRecurringTransaction(id: number): Promise<void> {
  await apiFetch(`/recurring-transactions/${id}`, { method: "DELETE" });
}

export async function detectRecurringTransactions(): Promise<{ detected: number; patterns: number; items: RecurringTransaction[] }> {
  return apiFetch("/recurring-transactions/detect", { method: "POST" }) as Promise<{ detected: number; patterns: number; items: RecurringTransaction[] }>;
}

/* ---------- Onboarding ---------- */

export type DefaultCategory = {
  name: string;
  type: string;
  icon: string;
  suggested_budget: number | null;
};

export async function getDefaultCategories(): Promise<DefaultCategory[]> {
  return apiFetch("/onboarding/default-categories") as Promise<DefaultCategory[]>;
}

export async function setupCategories(categories: { name: string; type: string; budget_limit?: number }[]): Promise<{ created: number }> {
  return apiFetch("/onboarding/setup-categories", {
    method: "POST",
    body: JSON.stringify({ categories }),
  }) as Promise<{ created: number }>;
}

export async function completeOnboarding(): Promise<{ is_onboarded: boolean }> {
  return apiFetch("/onboarding/complete", { method: "POST" }) as Promise<{ is_onboarded: boolean }>;
}
