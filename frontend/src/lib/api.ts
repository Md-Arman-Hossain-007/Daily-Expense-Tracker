export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

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
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export async function createTransaction(data: TransactionCreate): Promise<Transaction> {
  const res = await fetch(`${API_URL}/transactions/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create transaction');
  return res.json();
}

export async function deleteTransaction(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/transactions/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete transaction');
}

export async function undoDeleteTransaction(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/transactions/${id}/undo`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to undo delete transaction');
}

export async function updateTransaction(id: number, data: TransactionCreate): Promise<Transaction> {
  const res = await fetch(`${API_URL}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update transaction');
  return res.json();
}

export async function updateTransactionStatus(id: number, status: 'pending' | 'done'): Promise<Transaction> {
  const res = await fetch(`${API_URL}/transactions/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function fetchSummary(month: number, year: number): Promise<MonthlySummary> {
  const res = await fetch(`${API_URL}/summary/?month=${month}&year=${year}`, { cache: 'no-store' });
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
  const res = await fetch(`${API_URL}/budgets/?month=${month}&year=${year}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch budget');
  return res.json();
}

export async function updateBudget(month: number, year: number, amount: number): Promise<Budget> {
  const res = await fetch(`${API_URL}/budgets/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, year, amount }),
  });
  if (!res.ok) throw new Error('Failed to update budget');
  return res.json();
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
  const res = await fetch(`${API_URL}/recurring/`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch recurring transactions');
  return res.json();
}

export async function createRecurring(data: RecurringTransactionCreate): Promise<RecurringTransaction> {
  const res = await fetch(`${API_URL}/recurring/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create recurring transaction');
  return res.json();
}

export async function deleteRecurring(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/recurring/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete recurring transaction');
}

export async function applyRecurring(): Promise<void> {
  const res = await fetch(`${API_URL}/recurring/apply`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to apply recurring transactions');
}

export interface TrendData {
  name: string;
  income: number;
  expense: number;
}

export async function fetchTrends(): Promise<TrendData[]> {
  const res = await fetch(`${API_URL}/analytics/trends`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch trends');
  return res.json();
}
