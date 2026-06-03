'use client';

import { useState, useEffect } from 'react';
import { fetchTrends, TrendData, API_URL } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Analytics() {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchTrends();
        setTrends(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleExport = () => {
    window.open(`${API_URL}/export/csv`, '_blank');
  };

  const handleBackup = async () => {
    try {
      const res = await fetch(`${API_URL}/backup/`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budget_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download backup');
    }
  };

  const handleRestore = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('This will OVERWRITE your current data with the backup. Proceed?')) return;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const payload = JSON.parse(event.target?.result as string);
          const res = await fetch(`${API_URL}/restore/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            alert('Backup restored successfully! Please refresh the page.');
            window.location.reload();
          } else {
            alert('Failed to restore backup. Make sure the file is valid.');
          }
        } catch (err) {
          alert('Error parsing backup file');
        }
      };
      reader.readAsText(file);
    };
    fileInput.click();
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Analytics & Data</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View your spending trends and manage your data.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRestore}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm flex items-center gap-2"
          >
            <span>⬆️</span> Restore JSON
          </button>
          <button
            onClick={handleBackup}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
          >
            <span>⬇️</span> Backup JSON
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"
          >
            <span>📥</span> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-6">Income vs Expense Trend (Last 6 Months)</h3>
        {loading ? (
          <div className="h-[400px] flex items-center justify-center text-gray-400">Loading chart data...</div>
        ) : trends.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-gray-400">No data available.</div>
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `৳${value}`}
                />
                <Tooltip 
                  formatter={(value: number) => `৳${value.toFixed(2)}`}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f9fafb' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar dataKey="expense" name="Expense" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
