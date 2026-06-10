'use client';

import { useState, useEffect } from 'react';
import Dashboard from '@/components/Dashboard';
import LoginScreen from '@/components/LoginScreen';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('budget_token');
    setToken(saved);
    setChecking(false);
  }, []);

  if (checking) return null;

  if (!token) {
    return <LoginScreen onLogin={(t) => setToken(t)} />;
  }

  return <Dashboard token={token} onLogout={() => { localStorage.removeItem('budget_token'); setToken(null); }} />;
}
