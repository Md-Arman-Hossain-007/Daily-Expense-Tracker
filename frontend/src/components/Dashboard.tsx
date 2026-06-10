'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchSummary, fetchTransactions, deleteTransaction, updateTransactionStatus, fetchBudget, updateBudget, undoDeleteTransaction, createTransaction, Transaction, MonthlySummary, Budget, TransactionCreate, CategoryBudget, fetchCategoryBudgets, updateCategoryBudget, fetchRollover } from '@/lib/api';
import TransactionForm from './TransactionForm';
import Recurring from './Recurring';
import Analytics from './Analytics';
import DebtTracker from './DebtTracker';
import SavingsGoals from './SavingsGoals';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';

const COLORS = [
  '#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16',
  '#3B82F6', '#A855F7', '#22C55E', '#EAB308', '#F43F5E',
  '#0EA5E9', '#D946EF', '#059669', '#FB923C', '#6366F1',
];

interface DashboardProps {
  token?: string;
  onLogout?: () => void;
}

export default function Dashboard({ token, onLogout }: DashboardProps = {}) {
  const [date, setDate] = useState(new Date());
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showChart, setShowChart] = useState(false);
  const [chartTab, setChartTab] = useState<'overview' | 'budget' | 'breakdown'>('budget');
  const [budget, setBudget] = useState<Budget | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [editingCatBudget, setEditingCatBudget] = useState<string | null>(null);
  const [catBudgetInput, setCatBudgetInput] = useState('');
  const [rollovers, setRollovers] = useState<Record<string, number>>({});
  const [view, setView] = useState<'dashboard' | 'recurring' | 'analytics' | 'goals' | 'debts'>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [toast, setToast] = useState<{ message: string; undoId?: number } | null>(null);

  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesType = filter === 'all' || t.type === filter;
      const matchesSearch = t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [transactions, filter, searchQuery]);

  const pieData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + Number(tx.amount);
      return acc;
    }, {} as Record<string, number>);
    return Object.keys(grouped).map(key => ({
      name: key,
      value: grouped[key]
    })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const categoryExpenses = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense' && t.status === 'done');
    const grouped = expenses.reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + Number(tx.amount);
      return acc;
    }, {} as Record<string, number>);
    return grouped;
  }, [transactions]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    Object.keys(categoryExpenses).forEach(c => cats.add(c));
    categoryBudgets.forEach(cb => cats.add(cb.category));
    return Array.from(cats).sort();
  }, [categoryExpenses, categoryBudgets]);

  const overviewData = useMemo(() => [
    { name: 'Income', value: Number(summary?.total_income || 0), fill: '#10B981' },
    { name: 'Expenses', value: Number(summary?.total_expense || 0), fill: '#EF4444' },
    { name: 'Balance', value: Math.max(0, Number(summary?.balance || 0)), fill: '#6366F1' },
  ], [summary]);

  const budgetChartData = useMemo(() => uniqueCategories.map(cat => {
    const spent = categoryExpenses[cat] || 0;
    const catBudgetObj = categoryBudgets.find(cb => cb.category === cat);
    const baseBudget = catBudgetObj?.amount || 0;
    const rollover = rollovers[cat] || 0;
    const totalBudget = baseBudget > 0 ? Math.max(0, baseBudget + rollover) : 0;
    const exceeded = totalBudget > 0 && spent > totalBudget;
    return { name: cat, Spent: spent, Budget: totalBudget > 0 ? totalBudget : null, exceeded };
  }), [uniqueCategories, categoryExpenses, categoryBudgets, rollovers]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumData, txData, budgetData, catBudgetsData, rolloverData] = await Promise.all([
        fetchSummary(month, year),
        fetchTransactions(month, year),
        fetchBudget(month, year).catch(() => null),
        fetchCategoryBudgets(month, year).catch(() => []),
        fetchRollover(month, year).catch(() => ({})),
      ]);
      setSummary(sumData);
      setTransactions(txData);
      setBudget(budgetData);
      setCategoryBudgets(catBudgetsData);
      setRollovers(rolloverData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [month, year]);

  // Load dark mode from localStorage on mount and sync .dark class on <html>
  useEffect(() => {
    const savedDark = localStorage.getItem('budgetTrackerDark');
    const isDark = savedDark === 'true';
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setView('dashboard');
        setTimeout(() => {
          document.querySelector<HTMLInputElement>('input[type="number"]')?.focus();
        }, 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleDarkMode = () => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    localStorage.setItem('budgetTrackerDark', String(newDark));
    // Sync .dark class on <html> so Tailwind dark: variant classes work
    if (newDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const showToast = (message: string, undoId?: number) => {
    setToast({ message, undoId });
    setTimeout(() => {
      setToast(current => (current?.undoId === undoId ? null : current));
    }, 5000);
  };

  const handleDelete = async (id: number) => {
    await deleteTransaction(id);
    loadData();
    showToast('Transaction deleted', id);
  };

  const handleUndo = async (id: number) => {
    await undoDeleteTransaction(id);
    loadData();
    setToast(null);
  };

  const handleDuplicate = async (tx: Transaction) => {
    const data: TransactionCreate = {
      type: tx.type,
      amount: Number(tx.amount),
      category: tx.category,
      description: tx.description,
      date: new Date().toISOString().split('T')[0],
      status: tx.status,
      tags: tx.tags,
    };
    await createTransaction(data);
    loadData();
    showToast('Transaction duplicated');
  };

  const handleEdit = (tx: Transaction) => setEditingTx(tx);
  const handleCancelEdit = () => setEditingTx(null);
  const handlePrevMonth = () => setDate(new Date(year, month - 2));
  const handleNextMonth = () => setDate(new Date(year, month));

  const handleToggleStatus = async (tx: Transaction) => {
    const newStatus = tx.status === 'pending' ? 'done' : 'pending';
    await updateTransactionStatus(tx.id, newStatus);
    loadData();
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>

      {/* Header */}
      <header className={`shadow-sm border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <h1 className={`text-2xl font-semibold tracking-tight whitespace-nowrap ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
              Budget Tracker
            </h1>
            <nav className={`flex items-center gap-2 p-1 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              {[['dashboard', '🏠 Dashboard'], ['analytics', '📈 Analytics'], ['goals', '🎯 Savings Goals'], ['debts', '🤝 Debt Tracker'], ['recurring', '🔁 Recurring']].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v as any)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${view === v
                    ? darkMode ? 'bg-gray-600 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm'
                    : darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              title="Toggle Dark Mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button
              onClick={handlePrevMonth}
              className={`p-2 rounded-full transition-colors font-medium ${darkMode ? 'text-gray-100 hover:bg-gray-700' : 'text-gray-800 hover:bg-gray-100'}`}
            >
              ←
            </button>
            <span suppressHydrationWarning className={`font-medium text-lg w-32 text-center ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
              {date.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={handleNextMonth}
              className={`p-2 rounded-full transition-colors font-medium ${darkMode ? 'text-gray-100 hover:bg-gray-700' : 'text-gray-800 hover:bg-gray-100'}`}
            >
              →
            </button>
            <button
              onClick={() => setShowChart(true)}
              disabled={pieData.length === 0}
              className="ml-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-indigo-700 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>📊</span> Show Chart
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className={`ml-2 flex items-center whitespace-nowrap gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/20' : 'text-gray-500 hover:text-red-600 hover:bg-red-50'}`}
                title="Sign Out"
              >
                🚪 Sign Out
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Recurring View */}
      {view === 'recurring' && (
        <main className="max-w-5xl mx-auto px-4 py-8">
          <Recurring darkMode={darkMode} />
        </main>
      )}

      {/* Analytics View */}
      {view === 'analytics' && (
        <main className="max-w-5xl mx-auto px-4 py-8">
          <Analytics month={month} year={year} darkMode={darkMode} />
        </main>
      )}

      {/* Goals View */}
      {view === 'goals' && (
        <main className="max-w-5xl mx-auto px-4 py-8 animate-in fade-in duration-300">
          <SavingsGoals darkMode={darkMode} />
        </main>
      )}

      {/* Debt Tracker View */}
      {view === 'debts' && (
        <main className="max-w-5xl mx-auto px-4 py-8 animate-in fade-in duration-300">
          <DebtTracker darkMode={darkMode} />
        </main>
      )}

      {/* Dashboard View */}
      {view === 'dashboard' && (
        <main className="max-w-[96rem] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-76px)] overflow-hidden">

          {/* Left Column: Form */}
          <div className="lg:col-span-3 h-full overflow-y-auto pb-8 pr-2">
            <TransactionForm
              key={editingTx?.id ?? 'new'}
              onAdd={() => { loadData(); setEditingTx(null); }}
              editTx={editingTx}
              onCancelEdit={handleCancelEdit}
              categories={uniqueCategories}
              month={month}
              year={year}
              darkMode={darkMode}
            />
          </div>

          {/* Middle Column: Summary + Budget + Transactions */}
          <div className="lg:col-span-5 space-y-6 h-full overflow-y-auto pb-8 pr-2">

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Income', value: summary?.total_income || '0.00', color: 'text-green-600' },
                { label: 'Expenses', value: summary?.total_expense || '0.00', color: 'text-red-500' },
                { label: 'Balance', value: summary?.balance || '0.00', color: (summary?.balance || 0) >= 0 ? (darkMode ? 'text-gray-100' : 'text-gray-800') : 'text-red-600' },
              ].map(card => (
                <div
                  key={card.label}
                  className={`p-5 rounded-2xl shadow-sm border flex flex-col justify-center items-center ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
                >
                  <span className={`text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{card.label}</span>
                  <span className={`text-xl font-semibold mt-1.5 ${card.color}`}>৳{card.value}</span>
                </div>
              ))}
            </div>

            {/* Budget Progress Bar */}
            <div className={`p-5 rounded-2xl shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <div className="flex justify-between items-end mb-2">
                <div>
                  <h3 className={`text-sm font-medium uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Monthly Budget</h3>
                  {isEditingBudget ? (
                    <form
                      className="flex items-center gap-2 mt-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          const newBudget = await updateBudget(month, year, parseFloat(budgetInput));
                          setBudget(newBudget);
                          setIsEditingBudget(false);
                        } catch {
                          alert('Failed to update budget');
                        }
                      }}
                    >
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0.01"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        className={`w-24 px-2 py-1 text-sm border rounded-md outline-none focus:border-blue-500 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200 text-gray-800'}`}
                        autoFocus
                      />
                      <button type="submit" className="text-xs bg-indigo-600 text-white px-2 py-1.5 rounded-md hover:bg-indigo-700">Save</button>
                      <button type="button" onClick={() => setIsEditingBudget(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancel</button>
                    </form>
                  ) : (
                    <div className={`text-lg font-semibold mt-1 flex items-center gap-2 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                      ৳{summary?.total_expense || '0.00'}
                      <span className="text-sm font-normal text-gray-400">
                        / {budget && budget.amount > 0 ? `৳${budget.amount}` : 'Not set'}
                      </span>
                      <button
                        onClick={() => { setBudgetInput(budget ? budget.amount.toString() : ''); setIsEditingBudget(true); }}
                        className="text-gray-400 hover:text-indigo-600 text-sm ml-2 p-1 transition-colors"
                        title="Edit budget"
                      >
                        ✎
                      </button>
                    </div>
                  )}
                </div>
                {budget && budget.amount > 0 && !isEditingBudget && (
                  <div className="text-sm font-medium text-gray-500">
                    {Math.min(100, Math.round(((summary?.total_expense || 0) / budget.amount) * 100))}% Used
                  </div>
                )}
              </div>
              {budget && budget.amount > 0 && (
                <div className={`w-full rounded-full h-2.5 overflow-hidden mt-3 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${(summary?.total_expense || 0) > budget.amount ? 'bg-red-500' : 'bg-blue-600'}`}
                    style={{ width: `${Math.min(100, ((summary?.total_expense || 0) / budget.amount) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Transactions List */}
            <div className={`rounded-2xl shadow-sm border overflow-hidden ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <div className={`px-5 py-4 border-b flex justify-between items-center ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-50 bg-gray-50/50'}`}>
                <h2 className={`text-lg font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Recent Transactions</h2>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-36 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200 text-gray-800'}`}
                    />
                  </div>
                  <div className={`flex p-1 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-200/50'}`}>
                    {(['all', 'income', 'expense'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all capitalize ${filter === f
                          ? darkMode ? 'bg-gray-600 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm'
                          : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading...</div>
              ) : filteredTransactions.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No transactions found.</div>
              ) : (
                <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-50'}`}>
                  {Object.entries(
                    filteredTransactions.reduce((acc, tx) => {
                      if (!acc[tx.category]) acc[tx.category] = [];
                      acc[tx.category].push(tx);
                      return acc;
                    }, {} as Record<string, typeof filteredTransactions>)
                  ).map(([cat, txs]) => (
                    <div key={cat} className={`p-5 transition-colors ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                      <h3 className={`text-md font-semibold mb-3 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{cat}</h3>
                      <ul className="space-y-3">
                        {txs.map(tx => (
                          <li
                            key={tx.id}
                            className={`flex items-center justify-between transition-colors ${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50/50'} p-2 rounded-lg -mx-2`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-sm ${tx.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                {tx.type === 'income' ? '+' : '-'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{tx.category}</p>
                                  {tx.type === 'expense' && (
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tx.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {tx.status === 'done' ? 'Paid' : 'Pending'}
                                    </span>
                                  )}
                                </div>
                                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {tx.description || 'No description'} • {tx.date}
                                  {tx.tags && (
                                    <span className="ml-1 text-[10px] text-indigo-400">
                                      {tx.tags.split(',').map(tag => `#${tag.trim()}`).join(' ')}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-green-600' : darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                                ৳{Number(tx.amount).toFixed(2)}
                              </span>
                              {tx.type === 'expense' && (
                                <button
                                  onClick={() => handleToggleStatus(tx)}
                                  className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all ${tx.status === 'pending'
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                    }`}
                                  title={tx.status === 'pending' ? 'Mark as paid' : 'Mark as pending'}
                                >
                                  {tx.status === 'pending' ? '✓ Paid' : '↩'}
                                </button>
                              )}
                              <button onClick={() => handleDuplicate(tx)} className="text-gray-400 hover:text-green-600 transition-all p-1 rounded" title="Duplicate">📋</button>
                              <button onClick={() => handleEdit(tx)} className="text-gray-400 hover:text-blue-600 transition-all p-1 rounded" title="Edit">✎</button>
                              <button onClick={() => handleDelete(tx.id)} className="text-gray-400 hover:text-red-600 transition-all p-1 rounded" title="Delete">✕</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Category Budgets */}
          <div className="lg:col-span-4 h-full overflow-y-auto pb-8 pr-2">
            <div className={`p-5 rounded-2xl shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <div className="flex items-center gap-2 mb-5">
                <h3 className={`text-sm font-medium uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Category Budgets</h3>
                <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${darkMode ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/50' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`} title="Unused budget or debt from previous months is automatically rolled over to the current month.">
                  🔄 Rollover Active
                </span>
              </div>
              {uniqueCategories.length === 0 ? (
                <p className="text-sm text-gray-400">No category expenses or budgets yet.</p>
              ) : (
                <div className="space-y-5">
                  {uniqueCategories.map(cat => {
                    const spent = categoryExpenses[cat] || 0;
                    const catBudgetObj = categoryBudgets.find(cb => cb.category === cat);
                    const baseBudget = catBudgetObj?.amount || 0;
                    const rollover = rollovers[cat] || 0;
                    const catBudgetAmt = baseBudget > 0 ? Math.max(0, baseBudget + rollover) : 0;
                    const isExceeded = catBudgetAmt > 0 && spent > catBudgetAmt;
                    const percentage = catBudgetAmt > 0 ? Math.min(100, Math.round((spent / catBudgetAmt) * 100)) : 0;
                    const catTransactions = transactions.filter(t => t.category === cat && t.type === 'expense');

                    return (
                      <div key={cat} className={`p-4 rounded-xl space-y-2 ${darkMode ? 'bg-gray-700/40' : 'bg-gray-50/80'}`}>
                        <div className="flex justify-between items-center text-sm">
                          <span className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{cat}</span>

                          {editingCatBudget === cat ? (
                            <form
                              className="flex items-center gap-2"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                try {
                                  await updateCategoryBudget(cat, month, year, parseFloat(catBudgetInput));
                                  const updatedBudgets = await fetchCategoryBudgets(month, year);
                                  setCategoryBudgets(updatedBudgets);
                                  setEditingCatBudget(null);
                                } catch {
                                  alert('Failed to update category budget');
                                }
                              }}
                            >
                              <input
                                type="number"
                                step="0.01"
                                required
                                min="0.01"
                                value={catBudgetInput}
                                onChange={(e) => setCatBudgetInput(e.target.value)}
                                className={`w-20 px-2 py-0.5 text-xs border rounded-md outline-none focus:border-blue-500 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200 text-gray-800'}`}
                                autoFocus
                              />
                              <button type="submit" className="text-[10px] bg-indigo-600 text-white px-1.5 py-1 rounded hover:bg-indigo-700">Save</button>
                              <button type="button" onClick={() => setEditingCatBudget(null)} className="text-[10px] text-gray-500 hover:text-gray-700">Cancel</button>
                            </form>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={isExceeded ? 'text-red-500 font-medium' : darkMode ? 'text-gray-300' : 'text-gray-600'}>
                                ৳{spent} <span className="text-gray-400 font-normal">/ {catBudgetAmt > 0 ? `৳${catBudgetAmt.toFixed(2)}` : 'Not set'}</span>
                              </span>
                              {baseBudget > 0 && rollover !== 0 && (
                                <span className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1.5 font-medium shadow-sm border ${darkMode ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`} title="Base Budget + Rollover">
                                  <span>Base: ৳{baseBudget.toFixed(2)}</span>
                                  <span className="opacity-50">|</span>
                                  <span className="flex items-center gap-0.5">
                                    🔄 Rollover: <span className={rollover > 0 ? (darkMode ? 'text-emerald-400 font-bold' : 'text-emerald-600 font-bold') : (darkMode ? 'text-red-400 font-bold' : 'text-red-600 font-bold')}>{rollover > 0 ? `+৳${rollover.toFixed(2)}` : `-৳${Math.abs(rollover).toFixed(2)}`}</span>
                                  </span>
                                </span>
                              )}
                              {catBudgetAmt > 0 && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium whitespace-nowrap tracking-wide shadow-sm ${isExceeded ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                  {isExceeded ? `Exceeded by ৳${Number(spent - catBudgetAmt).toFixed(2)}` : `৳${Number(catBudgetAmt - spent).toFixed(2)} left`}
                                </span>
                              )}
                              <button
                                onClick={() => { setCatBudgetInput(baseBudget > 0 ? baseBudget.toString() : ''); setEditingCatBudget(cat); }}
                                className="text-gray-400 hover:text-indigo-600 p-0.5 transition-colors"
                                title="Edit category budget"
                              >
                                ✎
                              </button>
                            </div>
                          )}
                        </div>
                        {catBudgetAmt > 0 && !editingCatBudget && (
                          <div className={`w-full rounded-full h-1.5 overflow-hidden ${darkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                            <div
                              className={`h-1.5 rounded-full transition-all duration-500 ${isExceeded ? 'bg-red-500' : 'bg-indigo-500'}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        )}
                        {/* List of transactions for this category */}
                        {catTransactions.length > 0 && (
                          <div className={`pt-2 pl-3 space-y-2 border-l-2 ml-1 ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                            {catTransactions.map(tx => (
                              <div key={tx.id} className="flex justify-between items-center text-xs">
                                <div className="flex flex-col">
                                  <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{tx.description || 'No description'}</span>
                                  <span className="text-[10px] text-gray-400">{tx.date} {tx.status === 'pending' ? <span className="text-amber-500 ml-1">(Pending)</span> : ''}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>৳{Number(tx.amount).toFixed(2)}</span>
                                  <div className="flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(tx)} className="text-gray-400 hover:text-blue-500" title="Edit">✎</button>
                                    <button onClick={() => handleDelete(tx.id)} className="text-gray-400 hover:text-red-500" title="Delete">✕</button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </main>
      )}

      {/* Chart Modal */}
      {showChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowChart(false)}>
          <div className={`rounded-2xl shadow-2xl w-full max-w-3xl mx-4 relative flex flex-col ${darkMode ? 'bg-gray-800' : 'bg-white'}`} style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`flex justify-between items-center px-8 pt-7 pb-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <h2 className={`text-xl font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Budget Analytics</h2>
              <button onClick={() => setShowChart(false)} className={`rounded-full w-8 h-8 flex items-center justify-center transition-colors text-lg text-gray-400 ${darkMode ? 'hover:bg-gray-700 hover:text-gray-200' : 'hover:bg-gray-100 hover:text-gray-700'}`}>✕</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-8 pt-4 pb-0">
              {([['budget', '📊 Budget vs Actual'], ['overview', '💰 Financial Overview'], ['breakdown', '🥧 Expense Breakdown']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setChartTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${chartTab === tab
                    ? darkMode ? 'bg-gray-700 text-indigo-400 border-b-2 border-indigo-400' : 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                    : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Chart Area */}
            <div className="flex-1 overflow-auto px-8 py-6" style={{ minHeight: '420px' }}>

              {/* Budget vs Actual Bar Chart */}
              {chartTab === 'budget' && (
                <div>
                  <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Comparing what you <strong>spent</strong> vs your <strong>budget limit</strong> per category. <span className="text-red-500">Red</span> bars indicate exceeded budgets.
                  </p>
                  {budgetChartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-gray-400">No expense data yet.</div>
                  ) : (
                    <div style={{ height: Math.max(320, budgetChartData.length * 60) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={budgetChartData} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={darkMode ? '#374151' : '#f0f0f0'} />
                          <XAxis
                            type="number"
                            tickFormatter={v => `৳${v}`}
                            tick={{ fill: darkMode ? '#9CA3AF' : '#6b7280', fontSize: 11 }}
                            axisLine={false} tickLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={90}
                            tick={{ fill: darkMode ? '#D1D5DB' : '#374151', fontSize: 12, fontWeight: 500 }}
                            axisLine={false} tickLine={false}
                          />
                          <Tooltip
                            formatter={(value: any, name: any) => [`৳${Number(value).toFixed(2)}`, name]}
                            contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', background: darkMode ? '#1F2937' : '#fff' }}
                            labelStyle={{ color: darkMode ? '#F3F4F6' : '#111827', fontWeight: 600 }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} />
                          <Bar dataKey="Budget" name="Budget" fill="#6366F1" opacity={0.35} radius={[0, 4, 4, 0]} maxBarSize={20} />
                          <Bar dataKey="Spent" name="Spent" radius={[0, 4, 4, 0]} maxBarSize={20}>
                            {budgetChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.exceeded ? '#EF4444' : '#10B981'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex gap-6 mt-4 flex-wrap">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
                      <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Within budget</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
                      <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Budget exceeded</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full bg-indigo-400 opacity-50 inline-block"></span>
                      <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Budget limit</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Overview */}
              {chartTab === 'overview' && (
                <div>
                  <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Your high-level financial summary for <strong>{date.toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>.
                  </p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overviewData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#374151' : '#f0f0f0'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: darkMode ? '#9CA3AF' : '#6b7280', fontSize: 13, fontWeight: 500 }} />
                        <YAxis
                          tickFormatter={v => `৳${v}`}
                          tick={{ fill: darkMode ? '#9CA3AF' : '#6b7280', fontSize: 11 }}
                          axisLine={false} tickLine={false}
                        />
                        <Tooltip
                          formatter={(value: any) => [`৳${Number(value).toFixed(2)}`]}
                          contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', background: darkMode ? '#1F2937' : '#fff' }}
                        />
                        <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]} maxBarSize={80}>
                          {overviewData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className={`mt-6 grid grid-cols-3 gap-4 p-4 rounded-xl ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Income</p>
                      <p className="text-lg font-bold text-green-500 mt-1">৳{Number(summary?.total_income || 0).toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Expenses</p>
                      <p className="text-lg font-bold text-red-500 mt-1">৳{Number(summary?.total_expense || 0).toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Balance</p>
                      <p className={`text-lg font-bold mt-1 ${(summary?.balance || 0) >= 0 ? 'text-indigo-500' : 'text-red-600'}`}>৳{Number(summary?.balance || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Expense Breakdown Pie */}
              {chartTab === 'breakdown' && (
                <div>
                  <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Breakdown of your total expenses by category.
                  </p>
                  {pieData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-gray-400">No expense data yet.</div>
                  ) : (
                    <div className="h-[380px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="40%" cy="45%"
                            outerRadius={130} innerRadius={75}
                            paddingAngle={2}
                            animationBegin={0} animationDuration={600}
                          >
                            {pieData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => `৳${Number(value).toFixed(2)}`} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', background: darkMode ? '#1F2937' : '#fff' }} />
                          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ right: 0, paddingLeft: '12px', fontSize: '13px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4 z-50">
          <span className="text-sm font-medium">{toast.message}</span>
          {toast.undoId && (
            <button
              onClick={() => handleUndo(toast.undoId!)}
              className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors bg-white/10 px-3 py-1.5 rounded-lg"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
