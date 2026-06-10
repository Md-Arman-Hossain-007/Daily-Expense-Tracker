'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

interface Props {
  onLogin: (token: string) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Attempt Login
      const form = new URLSearchParams();
      form.append('username', email); // OAuth2 expects 'username'
      form.append('password', password);
      
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      if (res.status === 404) {
        // User not found, attempt to register automatically
        const regRes = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        
        if (!regRes.ok) {
          const err = await regRes.json();
          setError(err.detail || 'Failed to sign up');
          setLoading(false);
          return;
        }
        
        const data = await regRes.json();
        localStorage.setItem('budget_token', data.access_token);
        onLogin(data.access_token);
        return;
      }

      if (!res.ok) { 
        setError('Invalid password'); 
        setLoading(false); 
        return; 
      }
      
      const data = await res.json();
      localStorage.setItem('budget_token', data.access_token);
      onLogin(data.access_token);
      
    } catch {
      setError('Could not connect to server');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-gray-900 to-gray-800 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-900/50 mb-4">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Daily Budget Tracker</h1>
          <p className="text-gray-400 mt-2">Sign in or create a new account instantly</p>
        </div>

        {/* Card */}
        <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all placeholder-gray-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all placeholder-gray-500"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-2.5">
                <span>⚠️</span> {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-900/50 disabled:opacity-50 focus:ring-4 focus:ring-indigo-500/30"
            >
              {loading ? 'Authenticating...' : 'Sign In / Sign Up'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-6">
            If you don't have an account, entering an email and password will create one automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
