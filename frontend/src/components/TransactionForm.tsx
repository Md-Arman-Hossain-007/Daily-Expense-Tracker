'use client';

import { useState } from 'react';
import { createTransaction, updateTransaction, TransactionCreate, Transaction, updateCategoryBudget } from '@/lib/api';

interface Props {
  onAdd: () => void;
  editTx?: Transaction | null;
  onCancelEdit?: () => void;
  categories?: string[];
  month?: number;
  year?: number;
}

export default function TransactionForm({ onAdd, editTx, onCancelEdit, categories = [], month, year }: Props) {
  // By using editTx?.id as a `key` in the parent, React will remount this component
  // whenever a different transaction is selected for editing — no useEffect needed.
  const [type, setType] = useState<'income' | 'expense'>(editTx?.type || 'expense');
  const [amount, setAmount] = useState(editTx ? String(editTx.amount) : '');
  const [category, setCategory] = useState(editTx?.category || '');
  const [description, setDescription] = useState(editTx?.description || '');
  const [tags, setTags] = useState(editTx?.tags || '');
  const [date, setDate] = useState(editTx?.date || new Date().toISOString().split('T')[0]);
  const [categoryBudget, setCategoryBudget] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data: TransactionCreate = {
        type,
        amount: parseFloat(amount),
        category,
        description,
        date,
        tags,
      };
      if (editTx) {
        await updateTransaction(editTx.id, data);
      } else {
        await createTransaction(data);
        if (type === 'expense' && categoryBudget && month && year) {
          await updateCategoryBudget(category, month, year, parseFloat(categoryBudget));
        }
        setAmount('');
        setCategory('');
        setDescription('');
        setTags('');
        setCategoryBudget('');
      }
      onAdd();
    } catch (err) {
      console.error(err);
      alert('Failed to save transaction');
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-800">{editTx ? 'Edit Transaction' : 'Add Transaction'}</h2>
        {editTx && (
          <button onClick={onCancelEdit} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        )}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Type toggle */}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <input
            type="text"
            required
            list="category-options"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={type === 'income' ? 'e.g. Salary, Bonus' : 'e.g. Groceries, Rent'}
            autoComplete="off"
          />
          <datalist id="category-options">
            {categories.map(cat => <option key={cat} value={cat} />)}
          </datalist>
        </div>

        {type === 'expense' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Budget <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">৳</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={categoryBudget}
                onChange={(e) => setCategoryBudget(e.target.value)}
                placeholder="Set budget for this category"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">If you set this, it will update the budget limit for this category.</p>
          </div>
        )}

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
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            required
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags <span className="text-gray-400 font-normal">(comma separated)</span>
          </label>
          <input
            type="text"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. vacation, food"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <textarea
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none h-20"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 focus:ring-4 focus:ring-gray-200 transition-all disabled:opacity-50"
        >
          {loading ? (editTx ? 'Saving...' : 'Adding...') : (editTx ? 'Save Changes' : 'Add Transaction')}
        </button>
      </form>
    </div>
  );
}
