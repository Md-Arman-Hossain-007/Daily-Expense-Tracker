'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchRecurring, createRecurring, deleteRecurring, applyRecurring, RecurringTransaction, RecurringTransactionCreate } from '@/lib/api';

export default function Recurring() {
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [nextDate, setNextDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRecurring();
      setRecurring(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data: RecurringTransactionCreate = {
        type,
        amount: parseFloat(amount),
        category,
        description,
        frequency,
        next_date: nextDate,
      };
      await createRecurring(data);
      setAmount('');
      setCategory('');
      setDescription('');
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to create recurring transaction');
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this recurring transaction?')) return;
    await deleteRecurring(id);
    loadData();
  };

  const handleApply = async () => {
    try {
      await applyRecurring();
      alert('Applied any pending recurring transactions!');
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to apply recurring transactions');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Form */}
      <div className="md:col-span-1">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-6">
          <h2 className="text-lg font-medium text-gray-800 mb-6">Add Recurring</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex p-1 bg-gray-50 rounded-lg">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'expense' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setType('expense')}
              >
                Expense
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'income' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setType('income')}
              >
                Income
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">৳</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Rent, Salary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Date</label>
              <input
                type="date"
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(Optional)</span></label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 focus:ring-4 focus:ring-gray-200 transition-all disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Recurring'}
            </button>
          </form>
        </div>
      </div>

      {/* List */}
      <div className="md:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
            <h2 className="text-lg font-medium text-gray-800">Recurring Transactions</h2>
            <button
              onClick={handleApply}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors rounded-lg text-sm font-medium"
            >
              🔄 Apply Pending
            </button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : recurring.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No recurring transactions set up.</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recurring.map(tx => (
                <li key={tx.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors group">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm ${tx.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                      {tx.type === 'income' ? '+' : '-'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{tx.category}</p>
                      <p className="text-sm text-gray-400">
                        {tx.frequency.charAt(0).toUpperCase() + tx.frequency.slice(1)} • Next: {tx.next_date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-gray-800'}`}>
                      ৳{Number(tx.amount).toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all p-2 rounded-md"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
