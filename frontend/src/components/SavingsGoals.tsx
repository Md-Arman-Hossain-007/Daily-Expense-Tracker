'use client';

import { useState, useEffect } from 'react';
import { SavingsGoal, fetchSavingsGoals, createSavingsGoal, deleteSavingsGoal, contributeToGoal, withdrawFromGoal } from '@/lib/api';

interface Props {
  darkMode: boolean;
}

export default function SavingsGoals({ darkMode }: Props) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState('#6366F1');
  const [formLoading, setFormLoading] = useState(false);

  const [activeGoalId, setActiveGoalId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<'contribute' | 'withdraw'>('contribute');
  const [actionAmount, setActionAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    setLoading(true);
    try {
      const data = await fetchSavingsGoals();
      setGoals(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await createSavingsGoal({
        name,
        target_amount: parseFloat(targetAmount),
        deadline: deadline || null,
        color,
      });
      setName('');
      setTargetAmount('');
      setDeadline('');
      setColor('#6366F1');
      setShowForm(false);
      await loadGoals();
    } catch (err) {
      console.error(err);
      alert('Failed to create savings goal');
    }
    setFormLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this savings goal?')) return;
    try {
      await deleteSavingsGoal(id);
      await loadGoals();
    } catch (err) {
      console.error(err);
      alert('Failed to delete goal');
    }
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoalId || !actionAmount) return;
    
    setActionLoading(true);
    try {
      const amount = parseFloat(actionAmount);
      if (actionType === 'contribute') {
        await contributeToGoal(activeGoalId, amount);
      } else {
        await withdrawFromGoal(activeGoalId, amount);
      }
      setActionAmount('');
      setActiveGoalId(null);
      await loadGoals();
    } catch (err) {
      console.error(err);
      alert(`Failed to ${actionType}`);
    }
    setActionLoading(false);
  };

  const inputClasses = `w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-800'}`;
  const labelClasses = `block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`;

  // SVG Circular Progress Ring
  const CircularProgress = ({ progress, color }: { progress: number; color: string }) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className={darkMode ? 'text-gray-700' : 'text-gray-200'}
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className={`p-6 rounded-2xl shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Savings Goals</h2>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Track progress towards your financial targets.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showForm 
              ? darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {showForm ? 'Cancel' : '+ New Goal'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateGoal} className={`mb-8 p-6 rounded-xl border ${darkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClasses}>Goal Name</label>
              <input
                type="text"
                required
                className={inputClasses}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. New Car, Vacation"
              />
            </div>
            <div>
              <label className={labelClasses}>Target Amount</label>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>৳</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className={`${inputClasses} pl-8`}
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className={labelClasses}>Deadline (Optional)</label>
              <input
                type="date"
                className={inputClasses}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClasses}>Color Theme</label>
              <div className="flex gap-2 items-center h-[42px]">
                {['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-white shadow-md' : 'border-transparent hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={formLoading}
            className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {formLoading ? 'Creating...' : 'Create Savings Goal'}
          </button>
        </form>
      )}

      {loading ? (
        <div className={`py-12 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading goals...</div>
      ) : goals.length === 0 ? (
        <div className={`py-12 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No savings goals yet. Create one to get started!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map(goal => {
            const progress = Math.min(100, Math.max(0, (goal.current_amount / goal.target_amount) * 100));
            const isCompleted = progress >= 100;

            return (
              <div key={goal.id} className={`p-5 rounded-xl border flex flex-col transition-all hover:shadow-md ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className={`font-semibold text-lg ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{goal.name}</h3>
                    {goal.deadline && (
                      <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Target: {new Date(goal.deadline).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleDelete(goal.id)} className={`p-1.5 rounded-md transition-colors ${darkMode ? 'text-gray-500 hover:text-red-400 hover:bg-gray-700' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col gap-1">
                    <div className="text-2xl font-bold" style={{ color: goal.color }}>
                      ৳{Number(goal.current_amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      of ৳{Number(goal.target_amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <CircularProgress progress={progress} color={goal.color} />
                </div>

                {isCompleted ? (
                  <div className={`mt-auto py-2 px-3 rounded-lg text-sm font-medium text-center flex items-center justify-center gap-2 ${darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'}`}>
                    <span>🎉</span> Goal Reached!
                  </div>
                ) : activeGoalId === goal.id ? (
                  <form onSubmit={handleAction} className="mt-auto space-y-3">
                    <div className={`flex p-1 rounded-lg ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                      <button type="button" onClick={() => setActionType('contribute')} className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${actionType === 'contribute' ? (darkMode ? 'bg-gray-700 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm') : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}>Add</button>
                      <button type="button" onClick={() => setActionType('withdraw')} className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${actionType === 'withdraw' ? (darkMode ? 'bg-gray-700 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm') : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}>Withdraw</button>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>৳</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          autoFocus
                          className={`w-full pl-6 pr-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200'}`}
                          value={actionAmount}
                          onChange={(e) => setActionAmount(e.target.value)}
                          placeholder="Amount"
                        />
                      </div>
                      <button type="submit" disabled={actionLoading} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">✓</button>
                      <button type="button" onClick={() => { setActiveGoalId(null); setActionAmount(''); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>✕</button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => { setActiveGoalId(goal.id); setActionType('contribute'); }}
                    className={`mt-auto w-full py-2 border rounded-lg text-sm font-medium transition-colors ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                  >
                    Update Progress
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
