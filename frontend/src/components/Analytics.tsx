'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchTrends,
  fetchYearlyTrends,
  fetchMoMComparison,
  importTransactionsBulk,
  fetchForecast,
  TrendData,
  YearlyTrendData,
  MoMComparisonData,
  ForecastDataPoint,
  TransactionCreate,
  API_URL
} from '@/lib/api';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface AnalyticsProps {
  darkMode?: boolean;
  currentMonth?: number;
  currentYear?: number;
  onImportSuccess?: () => void;
}

interface ParsedTx {
  tempId: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  isValid: boolean;
  error?: string;
}

export default function Analytics({
  darkMode = false,
  currentMonth = new Date().getMonth() + 1,
  currentYear = new Date().getFullYear(),
  onImportSuccess
}: AnalyticsProps) {
  // Tabs: '6month' | 'yearly' | 'mom' | 'forecast'
  const [activeTab, setActiveTab] = useState<'6month' | 'yearly' | 'mom' | 'forecast'>('6month');

  // 6-Month Trend States
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);

  // Yearly Trend States
  const [yearlyTrends, setYearlyTrends] = useState<YearlyTrendData[]>([]);
  const [yearlyYear, setYearlyYear] = useState<number>(currentYear);
  const [yearlyLoading, setYearlyLoading] = useState(true);

  // MoM Comparison States
  const [momData, setMomData] = useState<MoMComparisonData | null>(null);
  const [momMonth, setMomMonth] = useState<number>(currentMonth);
  const [momYear, setMomYear] = useState<number>(currentYear);
  const [momLoading, setMomLoading] = useState(true);

  // Forecast States
  const [forecastData, setForecastData] = useState<ForecastDataPoint[]>([]);
  const [forecastDays, setForecastDays] = useState<number>(30);
  const [forecastLoading, setForecastLoading] = useState(true);

  // CSV Import States
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTx[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);

  // Load 6-Month Trends
  const load6Month = useCallback(async () => {
    setTrendsLoading(true);
    try {
      const data = await fetchTrends();
      setTrends(data);
    } catch (err) {
      console.error(err);
    }
    setTrendsLoading(false);
  }, []);

  useEffect(() => {
    load6Month();
  }, [load6Month]);

  // Load Yearly Trends
  const loadYearlyData = useCallback(async () => {
    setYearlyLoading(true);
    try {
      const data = await fetchYearlyTrends(yearlyYear);
      setYearlyTrends(data);
    } catch (err) {
      console.error(err);
    }
    setYearlyLoading(false);
  }, [yearlyYear]);

  useEffect(() => {
    loadYearlyData();
  }, [loadYearlyData]);

  // Load MoM Comparison
  const loadMomData = useCallback(async () => {
    setMomLoading(true);
    try {
      const data = await fetchMoMComparison(momMonth, momYear);
      setMomData(data);
    } catch (err) {
      console.error(err);
    }
    setMomLoading(false);
  }, [momMonth, momYear]);

  useEffect(() => {
    loadMomData();
  }, [loadMomData]);

  // Load Forecast Data
  const loadForecastData = useCallback(async () => {
    setForecastLoading(true);
    try {
      const data = await fetchForecast(forecastDays);
      setForecastData(data);
    } catch (err) {
      console.error(err);
    }
    setForecastLoading(false);
  }, [forecastDays]);

  useEffect(() => {
    loadForecastData();
  }, [loadForecastData]);

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

  // CSV Parsing & Upload handler
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const lines = text.split(/\r?\n/);
        if (lines.length === 0 || !lines[0].trim()) {
          alert('Empty CSV file');
          return;
        }

        // Parse headers
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
        const parsed: ParsedTx[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Split line respecting quotes
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let char of line) {
            if (char === '"' || char === "'") {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());

          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] !== undefined ? values[index].replace(/["']/g, '') : '';
          });

          // Header aliases
          const rawDate = row.date || row.transaction_date || row.day || '';
          const rawType = (row.type || row.transaction_type || 'expense').toLowerCase().trim();
          const rawCategory = row.category || row.group || row.class || '';
          const rawAmount = parseFloat(row.amount || row.value || row.cost || '0');
          const rawDesc = row.description || row.memo || row.narrative || '';

          // Validation rules
          let isValid = true;
          let error = '';

          if (!rawDate || isNaN(Date.parse(rawDate))) {
            isValid = false;
            error = 'Date must be YYYY-MM-DD';
          } else if (rawType !== 'income' && rawType !== 'expense') {
            isValid = false;
            error = 'Type must be "income" or "expense"';
          } else if (isNaN(rawAmount) || rawAmount <= 0) {
            isValid = false;
            error = 'Amount must be positive';
          } else if (!rawCategory.trim()) {
            isValid = false;
            error = 'Category is required';
          }

          parsed.push({
            tempId: `${i}-${Date.now()}`,
            date: rawDate,
            type: rawType as 'income' | 'expense',
            category: rawCategory,
            amount: rawAmount,
            description: rawDesc,
            isValid,
            error
          });
        }

        if (parsed.length === 0) {
          alert('No transactions found in CSV');
          return;
        }

        setParsedTransactions(parsed);
        // Pre-select all valid rows
        setSelectedIds(new Set(parsed.filter(t => t.isValid).map(t => t.tempId)));
        setShowImportModal(true);
      } catch (err) {
        alert('Error parsing CSV file');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // CSV Template Downloader
  const downloadCsvTemplate = () => {
    const headers = 'Date,Type,Category,Amount,Description\n';
    const sample1 = '2026-06-09,income,Salary,100000.00,Monthly Salary\n';
    const sample2 = '2026-06-09,expense,Groceries,2500.00,Weekly Bazar\n';
    const sample3 = '2026-06-09,expense,Utilities,1200.00,Electricity Bill\n';
    
    const blob = new Blob([headers + sample1 + sample2 + sample3], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daily_budget_tracker_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Bulk Confirm Import Call
  const handleConfirmImport = async () => {
    const selected = parsedTransactions.filter(t => selectedIds.has(t.tempId));
    if (selected.length === 0) return;

    setImporting(true);
    try {
      const payload: TransactionCreate[] = selected.map(t => ({
        type: t.type,
        amount: t.amount,
        category: t.category,
        date: t.date,
        description: t.description,
        status: t.type === 'income' ? 'done' : 'pending'
      }));

      await importTransactionsBulk(payload);
      alert(`Successfully imported ${selected.length} transactions!`);
      setShowImportModal(false);
      setParsedTransactions([]);
      setSelectedIds(new Set());
      
      // Refresh local analytics states
      load6Month();
      loadYearlyData();
      loadMomData();

      // Trigger dashboard update
      onImportSuccess?.();
    } catch (err) {
      console.error(err);
      alert('Failed to import transactions. Make sure the backend is updated and running.');
    }
    setImporting(false);
  };

  // Toggle selection
  const toggleSelectAll = () => {
    const validTxs = parsedTransactions.filter(t => t.isValid);
    if (selectedIds.size === validTxs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(validTxs.map(t => t.tempId)));
    }
  };

  const toggleSelectOne = (tempId: string) => {
    const next = new Set(selectedIds);
    if (next.has(tempId)) {
      next.delete(tempId);
    } else {
      next.add(tempId);
    }
    setSelectedIds(next);
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i);
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  return (
    <div className="space-y-8">
      {/* Analytics & Data header */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-100 text-gray-800'}`}>
        <div>
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Analytics & Data</h2>
          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>View your spending trends and manage your data.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          <button
            onClick={handleRestore}
            className={`px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 ${darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
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

      {/* CSV Import Zone Card */}
      <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Text block */}
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
              <span>📥</span> Import Transactions from CSV
            </h3>
            <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Upload your bank statement or transaction logs to bulk add records. Download our formatting template first.
            </p>
          </div>
          {/* Buttons — always stay inside the card */}
          <div className="flex flex-shrink-0 items-center gap-3">
            <button
              onClick={downloadCsvTemplate}
              className={`whitespace-nowrap px-4 py-2 border rounded-lg text-sm font-medium transition-all ${
                darkMode
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              📄 Download Template
            </button>
            <label className="whitespace-nowrap cursor-pointer px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 transition-all rounded-lg text-sm font-medium text-center shadow-md">
              📂 Choose CSV File
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsvUpload}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className={`flex border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        {([
          { key: '6month', label: '📈 6-Month Trend' },
          { key: 'yearly', label: '🗓️ Yearly Trends' },
          { key: 'mom',    label: '🔄 MoM Comparison' },
          { key: 'forecast', label: '🔮 Cashflow Forecast' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-4 px-6 font-medium text-sm border-b-2 transition-all ${
              activeTab === key
                ? darkMode
                  ? 'border-indigo-400 text-indigo-400'
                  : 'border-indigo-600 text-indigo-600'
                : darkMode
                  ? 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 6-Month Trend Content */}
      {activeTab === '6month' && (
        <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`text-lg font-medium mb-6 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Income vs Expense Trend (Last 6 Months)</h3>
          {trendsLoading ? (
            <div className={`h-[400px] flex items-center justify-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading chart data...</div>
          ) : trends.length === 0 ? (
            <div className={`h-[400px] flex items-center justify-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No data available.</div>
          ) : (
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#374151" : "#f0f0f0"} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                    tickFormatter={(value) => `৳${value}`}
                  />
                  <Tooltip 
                    formatter={(value: any) => `৳${Number(value).toFixed(2)}`}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      backgroundColor: darkMode ? '#1F2937' : '#FFFFFF',
                      color: darkMode ? '#F3F4F6' : '#1F2937'
                    }}
                    cursor={{ fill: darkMode ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="expense" name="Expense" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Yearly Trends Content */}
      {activeTab === 'yearly' && (
        <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className={`text-lg font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Yearly Financial Trends</h3>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Select Year:</span>
              <select
                value={yearlyYear}
                onChange={(e) => setYearlyYear(Number(e.target.value))}
                className={`px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                  darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200 text-gray-800'
                }`}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {yearlyLoading ? (
            <div className={`h-[400px] flex items-center justify-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading chart data...</div>
          ) : yearlyTrends.length === 0 ? (
            <div className={`h-[400px] flex items-center justify-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No data available for this year.</div>
          ) : (
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearlyTrends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#374151" : "#f0f0f0"} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                    tickFormatter={(value) => `৳${value}`}
                  />
                  <Tooltip 
                    formatter={(value: any) => `৳${Number(value).toFixed(2)}`}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      backgroundColor: darkMode ? '#1F2937' : '#FFFFFF',
                      color: darkMode ? '#F3F4F6' : '#1F2937'
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="income" name="Income" stroke="#10B981" strokeWidth={3} activeDot={{ r: 8 }} dot={{ strokeWidth: 2, r: 4 }} />
                  <Line type="monotone" dataKey="expense" name="Expense" stroke="#EF4444" strokeWidth={3} activeDot={{ r: 8 }} dot={{ strokeWidth: 2, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Month-over-Month Comparison Content */}
      {activeTab === 'mom' && (
        <div className="space-y-6">
          {/* Selectors card */}
          <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className={`text-lg font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Month-over-Month Comparison</h3>
                <p className={`text-sm mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Compare target month's metrics directly to the preceding month.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={momMonth}
                  onChange={(e) => setMomMonth(Number(e.target.value))}
                  className={`px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200 text-gray-800'
                  }`}
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <select
                  value={momYear}
                  onChange={(e) => setMomYear(Number(e.target.value))}
                  className={`px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200 text-gray-800'
                  }`}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {momLoading ? (
            <div className={`h-64 flex items-center justify-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading comparison data...</div>
          ) : !momData ? (
            <div className={`h-64 flex items-center justify-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Failed to load comparison data.</div>
          ) : (
            <div className="space-y-6">
              {/* MoM stats cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Income card */}
                <div className={`p-6 rounded-2xl shadow-sm border transition-all ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                  <div className="flex justify-between items-start">
                    <span className={`text-sm font-medium uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Income Change</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm ${
                      momData.income.diff >= 0 
                        ? 'bg-emerald-500' 
                        : 'bg-red-500'
                    }`}>
                      {momData.income.diff >= 0 ? '+' : ''}{momData.income.percentage}%
                    </span>
                  </div>
                  <div className={`text-2xl font-bold mt-3 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                    ৳{momData.income.current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-sm mt-2 flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span>Previous month:</span>
                    <span className="font-semibold">৳{momData.income.previous.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className={`text-xs mt-1 font-medium ${momData.income.diff >= 0 ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-red-400' : 'text-red-500')}`}>
                    {momData.income.diff >= 0 ? '▲' : '▼'} ৳{Math.abs(momData.income.diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} change
                  </div>
                </div>

                {/* Expense card */}
                <div className={`p-6 rounded-2xl shadow-sm border transition-all ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                  <div className="flex justify-between items-start">
                    <span className={`text-sm font-medium uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Expense Change</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm ${
                      momData.expense.diff <= 0 
                        ? 'bg-emerald-500' 
                        : 'bg-red-500'
                    }`}>
                      {momData.expense.diff >= 0 ? '+' : ''}{momData.expense.percentage}%
                    </span>
                  </div>
                  <div className={`text-2xl font-bold mt-3 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                    ৳{momData.expense.current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-sm mt-2 flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span>Previous month:</span>
                    <span className="font-semibold">৳{momData.expense.previous.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className={`text-xs mt-1 font-medium ${momData.expense.diff <= 0 ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-red-400' : 'text-red-500')}`}>
                    {momData.expense.diff > 0 ? '▲ Exceeded by' : '▼ Saved'} ৳{Math.abs(momData.expense.diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Savings rate card */}
                <div className={`p-6 rounded-2xl shadow-sm border transition-all ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                  {(() => {
                    const currentNet = momData.income.current - momData.expense.current;
                    const prevNet = momData.income.previous - momData.expense.previous;
                    const netDiff = currentNet - prevNet;
                    return (
                      <>
                        <div className="flex justify-between items-start">
                          <span className={`text-sm font-medium uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Net Savings Change</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm ${
                            netDiff >= 0 
                              ? 'bg-emerald-500' 
                              : 'bg-red-500'
                          }`}>
                            {prevNet !== 0 ? `${netDiff >= 0 ? '+' : ''}${roundTo2((netDiff / Math.abs(prevNet)) * 100)}%` : netDiff >= 0 ? '+100%' : '-100%'}
                          </span>
                        </div>
                        <div className={`text-2xl font-bold mt-3 ${currentNet >= 0 ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-red-400' : 'text-red-500')}`}>
                          ৳{currentNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className={`text-sm mt-2 flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          <span>Previous month:</span>
                          <span className="font-semibold">৳{prevNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className={`text-xs mt-1 font-medium ${netDiff >= 0 ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-red-400' : 'text-red-500')}`}>
                          {netDiff >= 0 ? '▲ Increased by' : '▼ Decreased by'} ৳{Math.abs(netDiff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Category comparison table card */}
              <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <h4 className={`text-md font-semibold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Category Spending Comparison</h4>
                {momData.categories.length === 0 ? (
                  <p className="text-gray-400 text-center py-6 text-sm">No category-wise transactions to compare in these months.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className={`border-b text-xs font-semibold uppercase tracking-wider ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                          <th className="pb-3 pt-2">Category</th>
                          <th className="pb-3 pt-2 text-right">This Month ({momData.current_month})</th>
                          <th className="pb-3 pt-2 text-right">Last Month ({momData.previous_month})</th>
                          <th className="pb-3 pt-2 text-right">Difference</th>
                          <th className="pb-3 pt-2 text-right">Change</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y text-sm ${darkMode ? 'divide-gray-700/50 text-gray-200' : 'divide-gray-50 text-gray-700'}`}>
                        {momData.categories.map((c) => (
                          <tr key={c.category} className={`transition-colors ${darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'}`}>
                            <td className="py-3.5 font-medium">{c.category}</td>
                            <td className="py-3.5 text-right font-medium">৳{c.current.toFixed(2)}</td>
                            <td className={`py-3.5 text-right ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>৳{c.previous.toFixed(2)}</td>
                            <td className={`py-3.5 text-right font-semibold ${c.diff > 0 ? 'text-red-500' : c.diff < 0 ? 'text-green-500' : ''}`}>
                              {c.diff > 0 ? '+' : ''}{c.diff.toFixed(2)}
                            </td>
                            <td className="py-3.5 text-right">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold text-white shadow-sm ${
                                c.diff > 0
                                  ? 'bg-red-500'
                                  : c.diff < 0
                                  ? 'bg-emerald-500'
                                  : 'bg-gray-500'
                              }`}>
                                {c.diff > 0 ? '▲' : c.diff < 0 ? '▼' : ''} {Math.abs(c.percentage)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Forecast Content */}
      {activeTab === 'forecast' && (
        <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className={`text-lg font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Future Cashflow Forecast</h3>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Forecast Days:</span>
              <select
                value={forecastDays}
                onChange={(e) => setForecastDays(Number(e.target.value))}
                className={`px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                  darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200 text-gray-800'
                }`}
              >
                <option value={15}>15 Days</option>
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days</option>
              </select>
            </div>
          </div>

          {forecastLoading ? (
            <div className={`h-[400px] flex items-center justify-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Simulating future cashflow...</div>
          ) : forecastData.length === 0 ? (
            <div className={`h-[400px] flex items-center justify-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No forecast data available. Add recurring transactions to see predictions.</div>
          ) : (
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#374151" : "#f0f0f0"} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }} 
                    dy={10}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
                    }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                    tickFormatter={(value) => `৳${value}`}
                  />
                  <Tooltip 
                    formatter={(value: any) => `৳${Number(value).toFixed(2)}`}
                    labelFormatter={(label) => {
                      const d = new Date(label as string);
                      return `${d.getDate()} ${d.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
                    }}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      backgroundColor: darkMode ? '#1F2937' : '#FFFFFF',
                      color: darkMode ? '#F3F4F6' : '#1F2937'
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="projected_balance" 
                    name="Projected Balance" 
                    stroke="#8B5CF6" 
                    strokeWidth={3} 
                    activeDot={{ r: 8 }} 
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* CSV Import Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border flex flex-col max-h-[90vh] transition-colors ${
            darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-100 text-gray-800'
          }`}>
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex justify-between items-center ${darkMode ? 'border-gray-700 bg-gray-800/80' : 'border-gray-100 bg-gray-50/80'}`}>
              <div>
                <h3 className="text-lg font-semibold">Verify Imported Transactions</h3>
                <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Confirm the parsed items and select which transactions to import.
                </p>
              </div>
              <button
                onClick={() => { setShowImportModal(false); setParsedTransactions([]); }}
                className={`transition-colors text-lg ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-700'}`}
              >
                ✕
              </button>
            </div>

            {/* Modal Table Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {parsedTransactions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No rows parsed.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b text-xs font-semibold uppercase tracking-wider ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                        <th className="pb-3 pt-2 pl-3">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={selectedIds.size === parsedTransactions.filter(t => t.isValid).length && parsedTransactions.filter(t => t.isValid).length > 0}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th className="pb-3 pt-2">Date</th>
                        <th className="pb-3 pt-2">Type</th>
                        <th className="pb-3 pt-2">Category</th>
                        <th className="pb-3 pt-2">Amount</th>
                        <th className="pb-3 pt-2">Description</th>
                        <th className="pb-3 pt-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y text-sm ${darkMode ? 'divide-gray-700/50 text-gray-200' : 'divide-gray-50 text-gray-700'}`}>
                      {parsedTransactions.map((t) => (
                        <tr
                          key={t.tempId}
                          className={`transition-colors ${
                            !t.isValid 
                              ? darkMode ? 'bg-red-950/20' : 'bg-red-50/30'
                              : selectedIds.has(t.tempId)
                              ? darkMode ? 'bg-indigo-950/10' : 'bg-indigo-50/10'
                              : darkMode ? 'hover:bg-gray-700/20' : 'hover:bg-gray-50/50'
                          }`}
                        >
                          <td className="py-3.5 pl-3">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                              disabled={!t.isValid}
                              checked={selectedIds.has(t.tempId)}
                              onChange={() => toggleSelectOne(t.tempId)}
                            />
                          </td>
                          <td className="py-3.5 font-medium whitespace-nowrap">{t.date}</td>
                          <td className="py-3.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold text-white shadow-sm ${
                              t.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'
                            }`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="py-3.5 font-medium">{t.category}</td>
                          <td className="py-3.5 font-semibold">৳{t.amount.toFixed(2)}</td>
                          <td className={`py-3.5 truncate max-w-[200px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} title={t.description}>
                            {t.description || <span className={`italic ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>None</span>}
                          </td>
                          <td className="py-3.5 text-right whitespace-nowrap">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              t.isValid
                                ? darkMode ? 'bg-green-950/30 text-green-400' : 'bg-green-50 text-green-700'
                                : darkMode ? 'bg-red-950/30 text-red-400' : 'bg-red-50 text-red-700'
                            }`}>
                              {t.isValid ? 'Valid' : `Invalid: ${t.error}`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`px-6 py-4 border-t flex justify-between items-center ${darkMode ? 'border-gray-700 bg-gray-800/80' : 'border-gray-100 bg-gray-50/80'}`}>
              <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Selected <span className={`font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{selectedIds.size}</span> of{' '}
                <span className={`font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{parsedTransactions.filter(t => t.isValid).length}</span> valid transactions
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowImportModal(false); setParsedTransactions([]); }}
                  className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    darkMode ? 'border-gray-600 hover:bg-gray-700 text-gray-300' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
                  }`}
                  disabled={importing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="px-5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-md"
                  disabled={selectedIds.size === 0 || importing}
                >
                  {importing ? 'Importing...' : `Import Selected (${selectedIds.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility rounding function
function roundTo2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
