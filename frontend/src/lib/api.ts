export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('budget_token') : null;
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...options, headers });
};


export interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number | string;
  category: string;
  description?: string;
  date: string;
  status: 'pending' | 'done';
  tags?: string;
  is_deleted: boolean;
}

export interface TransactionCreate {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description?: string;
  date: string;
  status?: 'pending' | 'done';
  tags?: string;
}

export interface MonthlySummary {
  total_income: number;
  total_expense: number;
  balance: number;
}

export async function fetchTransactions(month?: number, year?: number): Promise<Transaction[]> {
  let url = `${API_URL}/transactions/`;
  if (month && year) {
    url += `?month=${month}&year=${year}`;
  }
  const res = await apiFetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export async function createTransaction(data: TransactionCreate): Promise<Transaction> {
  const res = await apiFetch(`${API_URL}/transactions/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create transaction');
  return res.json();
}

export async function deleteTransaction(id: number): Promise<void> {
  const res = await apiFetch(`${API_URL}/transactions/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete transaction');
}

export async function undoDeleteTransaction(id: number): Promise<void> {
  const res = await apiFetch(`${API_URL}/transactions/${id}/undo`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to undo delete transaction');
}

export async function updateTransaction(id: number, data: TransactionCreate): Promise<Transaction> {
  const res = await apiFetch(`${API_URL}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update transaction');
  return res.json();
}

export async function updateTransactionStatus(id: number, status: 'pending' | 'done'): Promise<Transaction> {
  const res = await apiFetch(`${API_URL}/transactions/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function fetchSummary(month: number, year: number): Promise<MonthlySummary> {
  const res = await apiFetch(`${API_URL}/summary/?month=${month}&year=${year}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export interface Budget {
  id: number;
  month: number;
  year: number;
  amount: number;
}

export async function fetchBudget(month: number, year: number): Promise<Budget> {
  const res = await apiFetch(`${API_URL}/budgets/?month=${month}&year=${year}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch budget');
  return res.json();
}

export async function updateBudget(month: number, year: number, amount: number): Promise<Budget> {
  const res = await apiFetch(`${API_URL}/budgets/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, year, amount }),
  });
  if (!res.ok) throw new Error('Failed to update budget');
  return res.json();
}

export interface CategoryBudget {
  id: number;
  category: string;
  month: number;
  year: number;
  amount: number;
}

export async function fetchCategoryBudgets(month: number, year: number): Promise<CategoryBudget[]> {
  const res = await apiFetch(`${API_URL}/category-budgets/?month=${month}&year=${year}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch category budgets');
  return res.json();
}

export async function updateCategoryBudget(category: string, month: number, year: number, amount: number): Promise<CategoryBudget> {
  const res = await apiFetch(`${API_URL}/category-budgets/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, month, year, amount }),
  });
  if (!res.ok) throw new Error('Failed to update category budget');
  return res.json();
}

export async function deleteCategoryBudget(category: string, month: number, year: number): Promise<void> {
  const res = await apiFetch(`${API_URL}/category-budgets/${encodeURIComponent(category)}?month=${month}&year=${year}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete category budget and transactions');
}

export interface RecurringTransaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_date: string;
}

export interface RecurringTransactionCreate {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_date: string;
}

export async function fetchRecurring(): Promise<RecurringTransaction[]> {
  const res = await apiFetch(`${API_URL}/recurring/`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch recurring transactions');
  return res.json();
}

export async function createRecurring(data: RecurringTransactionCreate): Promise<RecurringTransaction> {
  const res = await apiFetch(`${API_URL}/recurring/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create recurring transaction');
  return res.json();
}

export async function deleteRecurring(id: number): Promise<void> {
  const res = await apiFetch(`${API_URL}/recurring/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete recurring transaction');
}

export async function applyRecurring(): Promise<void> {
  const res = await apiFetch(`${API_URL}/recurring/apply`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to apply recurring transactions');
}

export interface TrendData {
  name: string;
  income: number;
  expense: number;
}

export async function fetchTrends(): Promise<TrendData[]> {
  const res = await apiFetch(`${API_URL}/analytics/trends`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch trends');
  return res.json();
}

export interface YearlyTrendData {
  name: string;
  income: number;
  expense: number;
}

export interface ComparisonMetric {
  current: number;
  previous: number;
  diff: number;
  percentage: number;
}

export interface CategoryComparison {
  category: string;
  current: number;
  previous: number;
  diff: number;
  percentage: number;
}

export interface MoMComparisonData {
  current_month: string;
  previous_month: string;
  income: ComparisonMetric;
  expense: ComparisonMetric;
  categories: CategoryComparison[];
}

export async function fetchYearlyTrends(year?: number): Promise<YearlyTrendData[]> {
  let url = `${API_URL}/analytics/yearly-trends`;
  if (year) {
    url += `?year=${year}`;
  }
  const res = await apiFetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch yearly trends');
  return res.json();
}

export async function fetchMoMComparison(month: number, year: number): Promise<MoMComparisonData> {
  const res = await apiFetch(`${API_URL}/analytics/mom-comparison?month=${month}&year=${year}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch MoM comparison');
  return res.json();
}

export async function importTransactionsBulk(transactions: TransactionCreate[]): Promise<Transaction[]> {
  const res = await apiFetch(`${API_URL}/transactions/bulk/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transactions),
  });
  if (!res.ok) throw new Error('Failed to bulk import transactions');
  return res.json();
}

export async function fetchRollover(month: number, year: number): Promise<Record<string, number>> {
  const res = await apiFetch(`${API_URL}/analytics/rollover/?month=${month}&year=${year}`);
  if (!res.ok) throw new Error('Failed to fetch rollover data');
  return res.json();
}

export interface ForecastDataPoint {
  date: string;
  projected_balance: number;
}

export async function fetchForecast(days: number = 30): Promise<ForecastDataPoint[]> {
  const res = await apiFetch(`${API_URL}/analytics/forecast/?days=${days}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch forecast data');
  return res.json();
}

// --- Savings Goals ---
export interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string | null;
  color: string;
  notes?: string | null;
}

export interface SavingsGoalCreate {
  name: string;
  target_amount: number;
  current_amount?: number;
  deadline?: string | null;
  color?: string;
  notes?: string | null;
}

export async function fetchSavingsGoals(): Promise<SavingsGoal[]> {
  const res = await apiFetch(`${API_URL}/savings-goals/`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch savings goals');
  return res.json();
}

export async function createSavingsGoal(data: SavingsGoalCreate): Promise<SavingsGoal> {
  const res = await apiFetch(`${API_URL}/savings-goals/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create savings goal');
  return res.json();
}

export async function deleteSavingsGoal(id: number): Promise<void> {
  const res = await apiFetch(`${API_URL}/savings-goals/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete savings goal');
}

export async function contributeToGoal(id: number, amount: number): Promise<SavingsGoal> {
  const res = await apiFetch(`${API_URL}/savings-goals/${id}/contribute`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) throw new Error('Failed to contribute to goal');
  return res.json();
}

export async function withdrawFromGoal(id: number, amount: number): Promise<SavingsGoal> {
  const res = await apiFetch(`${API_URL}/savings-goals/${id}/withdraw`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) throw new Error('Failed to withdraw from goal');
  return res.json();
}

// --- Debt Tracker API ---
export interface Debt {
  id: number;
  person: string;
  amount: number;
  type: 'lent' | 'borrowed';
  description?: string;
}

export type DebtCreate = Omit<Debt, 'id'>;

export const fetchDebts = async (): Promise<Debt[]> => {
  const res = await apiFetch(`${API_URL}/debts/`);
  if (!res.ok) throw new Error('Failed to fetch debts');
  return res.json();
};

export const createDebt = async (debt: DebtCreate): Promise<Debt> => {
  const res = await apiFetch(`${API_URL}/debts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(debt),
  });
  if (!res.ok) throw new Error('Failed to create debt');
  return res.json();
};

export const deleteDebt = async (id: number): Promise<void> => {
  const res = await apiFetch(`${API_URL}/debts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete debt');
};
