import { useState, useEffect, useCallback } from 'react';
import { fetchDebts, createDebt, deleteDebt, Debt, DebtCreate } from '@/lib/api';

interface DebtTrackerProps {
  darkMode?: boolean;
}

export default function DebtTracker({ darkMode = false }: DebtTrackerProps) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'lent' | 'borrowed'>('lent');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDebts();
      setDebts(data);
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
      const data: DebtCreate = {
        person,
        amount: parseFloat(amount),
        type,
        description,
      };
      await createDebt(data);
      setPerson('');
      setAmount('');
      setDescription('');
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to add debt');
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this debt?')) return;
    await deleteDebt(id);
    loadData();
  };

  const totalLent = debts.filter(d => d.type === 'lent').reduce((acc, d) => acc + d.amount, 0);
  const totalBorrowed = debts.filter(d => d.type === 'borrowed').reduce((acc, d) => acc + d.amount, 0);
  const netDebt = totalLent - totalBorrowed;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`text-sm font-medium uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>You are Owed (Lent)</h3>
          <div className="text-3xl font-bold text-emerald-500">৳{totalLent.toFixed(2)}</div>
        </div>
        <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`text-sm font-medium uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>You Owe (Borrowed)</h3>
          <div className="text-3xl font-bold text-red-500">৳{totalBorrowed.toFixed(2)}</div>
        </div>
        <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`text-sm font-medium uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Net Balance</h3>
          <div className={`text-3xl font-bold ${netDebt >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {netDebt >= 0 ? '+' : ''}৳{netDebt.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className={`p-6 rounded-2xl shadow-sm border sticky top-6 transition-colors ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <h2 className={`text-lg font-medium mb-6 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Add Debt Record</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className={`flex p-1 rounded-lg ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                <button
                  type="button"
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    type === 'lent' 
                      ? darkMode ? 'bg-gray-700 shadow-sm text-emerald-400' : 'bg-white shadow-sm text-emerald-600'
                      : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setType('lent')}
                >
                  I Lent Money
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    type === 'borrowed' 
                      ? darkMode ? 'bg-gray-700 shadow-sm text-red-400' : 'bg-white shadow-sm text-red-600'
                      : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setType('borrowed')}
                >
                  I Borrowed
                </button>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Person / Entity</label>
                <input
                  type="text"
                  required
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'
                  }`}
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">৳</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'
                    }`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Description <span className={`font-normal ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(Optional)</span></label>
                <input
                  type="text"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'
                  }`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Dinner, Rent split"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all disabled:opacity-50 shadow-md ${
                  darkMode ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {saving ? 'Adding...' : 'Add Record'}
              </button>
            </form>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors h-full flex flex-col ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className={`px-6 py-5 border-b ${darkMode ? 'border-gray-700 bg-gray-800/80' : 'border-gray-50 bg-gray-50/50'}`}>
              <h2 className={`text-lg font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Debt Records</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className={`p-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>Loading...</div>
              ) : debts.length === 0 ? (
                <div className={`p-8 text-center flex flex-col items-center gap-3 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
                  <span className="text-4xl opacity-50">🤝</span>
                  <p>You have no active debts or loans.</p>
                </div>
              ) : (
                <ul className={`divide-y ${darkMode ? 'divide-gray-700/50' : 'divide-gray-50'}`}>
                  {debts.map(debt => (
                    <li key={debt.id} className={`p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors group ${darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'}`}>
                      <div className="flex items-start space-x-4">
                        <div className={`mt-1 w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-xl shadow-sm ${
                          debt.type === 'lent' 
                            ? darkMode ? 'bg-emerald-900/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                            : darkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-500'
                        }`}>
                          {debt.type === 'lent' ? '↑' : '↓'}
                        </div>
                        <div>
                          <p className={`font-semibold text-lg ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{debt.person}</p>
                          <p className={`text-sm font-medium ${debt.type === 'lent' ? 'text-emerald-500' : 'text-red-500'}`}>
                            {debt.type === 'lent' ? 'You lent them money' : 'They lent you money'}
                          </p>
                          {debt.description && (
                            <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {debt.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto space-x-4 pl-14 sm:pl-0">
                        <span className={`text-xl font-bold ${debt.type === 'lent' ? (darkMode ? 'text-emerald-400' : 'text-emerald-600') : (darkMode ? 'text-red-400' : 'text-red-600')}`}>
                          ৳{Number(debt.amount).toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleDelete(debt.id)}
                          className={`transition-all px-3 py-1.5 text-sm font-medium rounded-md border ${darkMode ? 'border-gray-600 text-gray-300 hover:text-red-400 hover:border-red-400 hover:bg-red-900/20' : 'border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50'}`}
                          title="Mark as Settled / Delete"
                        >
                          Settle
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
