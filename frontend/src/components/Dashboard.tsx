'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchSummary, fetchTransactions, deleteTransaction, updateTransactionStatus, fetchBudget, updateBudget, undoDeleteTransaction, createTransaction, Transaction, MonthlySummary, Budget, TransactionCreate } from '@/lib/api';
import TransactionForm from './TransactionForm';
import Recurring from './Recurring';
import Analytics from './Analytics';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = [
  '#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16',
  '#3B82F6', '#A855F7', '#22C55E', '#EAB308', '#F43F5E',
  '#0EA5E9', '#D946EF', '#059669', '#FB923C', '#6366F1',
];

export default function Dashboard() {
  const [date, setDate] = useState(new Date());
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showChart, setShowChart] = useState(false);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [view, setView] = useState<'dashboard' | 'recurring' | 'analytics'>('dashboard');
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumData, txData, budgetData] = await Promise.all([
        fetchSummary(month, year),
        fetchTransactions(month, year),
        fetchBudget(month, year).catch(() => null),
      ]);
      setSummary(sumData);
      setTransactions(txData);
      setBudget(budgetData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [month, year]);

  // Load dark mode from localStorage on mount
  useEffect(() => {
    const savedDark = localStorage.getItem('budgetTrackerDark');
    if (savedDark === 'true') setDarkMode(true);
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
            <h1 className={`text-2xl font-semibold tracking-tight ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
              Budget Tracker
            </h1>
            <nav className={`flex items-center gap-2 p-1 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              {(['dashboard', 'recurring', 'analytics'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
                    view === v
                      ? darkMode ? 'bg-gray-600 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm'
                      : darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
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
            <span className={`font-medium text-lg w-32 text-center ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
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
              className="ml-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>📊</span> Show Chart
            </button>
          </div>
        </div>
      </header>

      {/* Recurring View */}
      {view === 'recurring' && (
        <main className="max-w-5xl mx-auto px-4 py-8">
          <Recurring />
        </main>
      )}

      {/* Analytics View */}
      {view === 'analytics' && (
        <main className="max-w-5xl mx-auto px-4 py-8">
          <Analytics />
        </main>
      )}

      {/* Dashboard View */}
      {view === 'dashboard' && (
        <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Left Column: Form */}
          <div className="md:col-span-1">
            <TransactionForm
              key={editingTx?.id ?? 'new'}
              onAdd={() => { loadData(); setEditingTx(null); }}
              editTx={editingTx}
              onCancelEdit={handleCancelEdit}
            />
          </div>

          {/* Right Column */}
          <div className="md:col-span-2 space-y-8">

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Income', value: summary?.total_income || '0.00', color: 'text-green-600' },
                { label: 'Expenses', value: summary?.total_expense || '0.00', color: 'text-red-500' },
                { label: 'Balance', value: summary?.balance || '0.00', color: (summary?.balance || 0) >= 0 ? (darkMode ? 'text-gray-100' : 'text-gray-800') : 'text-red-600' },
              ].map(card => (
                <div
                  key={card.label}
                  className={`p-6 rounded-2xl shadow-sm border flex flex-col justify-center items-center ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
                >
                  <span className={`text-sm font-medium uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{card.label}</span>
                  <span className={`text-2xl font-semibold mt-2 ${card.color}`}>৳{card.value}</span>
                </div>
              ))}
            </div>

            {/* Budget Progress Bar */}
            <div className={`p-6 rounded-2xl shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
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
              <div className={`px-6 py-5 border-b flex justify-between items-center ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-50 bg-gray-50/50'}`}>
                <h2 className={`text-lg font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Recent Transactions</h2>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`pl-9 pr-4 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-48 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200 text-gray-800'}`}
                    />
                  </div>
                  <div className={`flex p-1 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-200/50'}`}>
                    {(['all', 'income', 'expense'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all capitalize ${
                          filter === f
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
                <ul className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-50'}`}>
                  {filteredTransactions.map(tx => (
                    <li
                      key={tx.id}
                      className={`p-6 flex items-center justify-between transition-colors ${
                        tx.type === 'expense' && tx.status === 'pending' ? 'opacity-60' : ''
                      } ${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50/50'}`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm ${tx.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                          {tx.type === 'income' ? '+' : '-'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{tx.category}</p>
                            {tx.type === 'expense' && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tx.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {tx.status === 'done' ? 'Paid' : 'Pending'}
                              </span>
                            )}
                          </div>
                          <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            {tx.description || 'No description'} • {tx.date}
                            {tx.tags && (
                              <span className="ml-2 text-xs text-indigo-400">
                                {tx.tags.split(',').map(tag => `#${tag.trim()}`).join(' ')}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                          ৳{Number(tx.amount).toFixed(2)}
                        </span>
                        {tx.type === 'expense' && (
                          <button
                            onClick={() => handleToggleStatus(tx)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                              tx.status === 'pending'
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                            title={tx.status === 'pending' ? 'Mark as paid' : 'Mark as pending'}
                          >
                            {tx.status === 'pending' ? '✓ Mark Paid' : '↩ Undo'}
                          </button>
                        )}
                        <button onClick={() => handleDuplicate(tx)} className="text-gray-500 hover:text-green-600 hover:bg-green-50 transition-all p-2 rounded-md" title="Duplicate">📋</button>
                        <button onClick={() => handleEdit(tx)} className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all p-2 rounded-md" title="Edit">✎</button>
                        <button onClick={() => handleDelete(tx.id)} className="text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all p-2 rounded-md" title="Delete">✕</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        </main>
      )}

      {/* Chart Modal */}
      {showChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowChart(false)}>
          <div className={`rounded-2xl shadow-2xl p-8 w-full max-w-2xl mx-4 relative ${darkMode ? 'bg-gray-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Expenses by Category</h2>
              <button onClick={() => setShowChart(false)} className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition-colors text-lg">✕</button>
            </div>
            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="40%" cy="45%" outerRadius={130} innerRadius={75} paddingAngle={2} animationBegin={0} animationDuration={600}>
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `৳${Number(value).toFixed(2)}`} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ right: 0, paddingLeft: '12px', fontSize: '13px' }} />
                </PieChart>
              </ResponsiveContainer>
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
