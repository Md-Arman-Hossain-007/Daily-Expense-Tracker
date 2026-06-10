'use client';

import { useState } from 'react';
import { createTransaction, updateTransaction, TransactionCreate, Transaction, updateCategoryBudget } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'];
const RATES_TO_BDT: Record<string, number> = { BDT: 1, USD: 110, EUR: 120, GBP: 140, JPY: 0.74, CAD: 80, AUD: 72, INR: 1.32 };

interface Props {
  onAdd: () => void;
  editTx?: Transaction | null;
  onCancelEdit?: () => void;
  categories?: string[];
  month?: number;
  year?: number;
  darkMode?: boolean;
}

export default function TransactionForm({ onAdd, editTx, onCancelEdit, categories = [], month, year, darkMode = false }: Props) {
  // By using editTx?.id as a `key` in the parent, React will remount this component
  // whenever a different transaction is selected for editing — no useEffect needed.
  const [type, setType] = useState<'income' | 'expense'>(editTx?.type || 'expense');
  const [amount, setAmount] = useState(editTx ? String(editTx.amount) : '');
  const [category, setCategory] = useState(editTx?.category || '');
  const [description, setDescription] = useState(editTx?.description || '');
  const [tags, setTags] = useState(editTx?.tags || '');
  const [date, setDate] = useState(editTx?.date || new Date().toISOString().split('T')[0]);
  const [categoryBudget, setCategoryBudget] = useState('');
  const [currency, setCurrency] = useState((editTx as any)?.currency || 'BDT');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState((editTx as any)?.receipt_url || '');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let finalReceiptUrl = receiptUrl;
      if (receiptFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append('file', receiptFile);
        const up = await fetch(`${API_BASE}/upload/`, { method: 'POST', body: fd });
        const upData = await up.json();
        finalReceiptUrl = upData.url;
        setUploading(false);
      }
      const bdt = parseFloat(amount) * (RATES_TO_BDT[currency] || 1);
      const data: TransactionCreate = {
        type,
        amount: bdt,
        category,
        description,
        date,
        tags,
        currency,
        receipt_url: finalReceiptUrl || undefined,
      } as any;
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

  const inputClasses = `w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-800'}`;
  const inputWithIconClasses = `w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-800'}`;
  const labelClasses = `block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <div className={`p-6 rounded-2xl shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-lg font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{editTx ? 'Edit Transaction' : 'Add Transaction'}</h2>
        {editTx && (
          <button onClick={onCancelEdit} className={`text-sm ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Cancel</button>
        )}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Type toggle */}
        <div className={`flex p-1 rounded-lg ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'expense' ? (darkMode ? 'bg-gray-700 shadow-sm text-gray-100' : 'bg-white shadow-sm text-gray-800') : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}
            onClick={() => setType('expense')}
          >
            Expense
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'income' ? (darkMode ? 'bg-gray-700 shadow-sm text-gray-100' : 'bg-white shadow-sm text-gray-800') : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}
            onClick={() => setType('income')}
          >
            Income
          </button>
        </div>

        <div>
          <label className={labelClasses}>Category</label>
          <input
            type="text"
            required
            list="category-options"
            className={inputClasses}
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
            <label className={labelClasses}>
              Category Budget <span className={`font-normal ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(Optional)</span>
            </label>
            <div className="relative">
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>৳</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className={inputWithIconClasses}
                value={categoryBudget}
                onChange={(e) => setCategoryBudget(e.target.value)}
                placeholder="Set budget for this category"
              />
            </div>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>If you set this, it will update the budget limit for this category.</p>
          </div>
        )}

        <div>
          <label className={labelClasses}>Currency</label>
          <select
            className={inputClasses}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {currency !== 'BDT' && amount && (
            <p className={`text-xs mt-1 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
              ≈ ৳{(parseFloat(amount) * (RATES_TO_BDT[currency] || 1)).toFixed(2)} BDT
            </p>
          )}
        </div>

        <div>
          <label className={labelClasses}>Amount ({currency})</label>
          <div className="relative">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>{currency === 'BDT' ? '৳' : currency[0]}</span>
            <input
              type="number"
              step="0.01"
              required
              min="0.01"
              className={inputWithIconClasses}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className={labelClasses}>Date</label>
          <input
            type="date"
            required
            className={inputClasses}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClasses}>
            Tags <span className={`font-normal ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(comma separated)</span>
          </label>
          <input
            type="text"
            className={inputClasses}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. vacation, food"
          />
        </div>

        <div>
          <label className={labelClasses}>
            Description <span className={`font-normal ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(Optional)</span>
          </label>
          <textarea
            className={`${inputClasses} resize-none h-20`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes..."
          />
        </div>

        <div>
          <label className={labelClasses}>Receipt / Attachment <span className={`font-normal ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(Optional)</span></label>
          <input
            type="file"
            accept="image/*,application/pdf"
            className={`w-full text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'} file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium ${darkMode ? 'file:bg-gray-700 file:text-gray-200' : 'file:bg-gray-100 file:text-gray-700'} hover:file:opacity-80`}
            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
          />
          {receiptUrl && !receiptFile && (
            <a href={`${API_BASE}${receiptUrl}`} target="_blank" rel="noopener noreferrer" className="text-xs mt-1 text-indigo-500 underline block">View current receipt</a>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all disabled:opacity-50 focus:ring-4 ${darkMode ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-900/50' : 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-200'}`}
        >
          {uploading ? 'Uploading receipt...' : loading ? (editTx ? 'Saving...' : 'Adding...') : (editTx ? 'Save Changes' : 'Add Transaction')}
        </button>
      </form>
    </div>
  );
}
