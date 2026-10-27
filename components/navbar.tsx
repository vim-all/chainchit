'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, UserCheck, Gavel, FileSpreadsheet, Activity, ChevronDown } from 'lucide-react';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'MEMBER' | 'FOREMAN' | 'OVERSIGHT_VIEWER';
  kycStatus: string;
  trustScore: number;
}

export function Navbar({ onUserChange }: { onUserChange?: (user: AuthUser) => void }) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [allUsers, setAllUsers] = useState<AuthUser[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSession();
  }, []);

  async function fetchSession() {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.currentUser) {
        setCurrentUser(data.currentUser);
        setAllUsers(data.allUsers || []);
        onUserChange?.(data.currentUser);
      }
    } catch (err) {
      console.error('Failed to fetch session', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitchUser(user: AuthUser) {
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      setCurrentUser(user);
      setIsDropdownOpen(false);
      onUserChange?.(user);
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch user', err);
    }
  }

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-neutral-950/80 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-emerald-400 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-neutral-950 rounded-[11px] flex items-center justify-center group-hover:bg-neutral-900 transition-colors">
                <Gavel className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">ChainChit</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Reverse Auction
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Statistical Fraud Detection Engine</p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              pathname === '/'
                ? 'bg-neutral-800 text-white shadow-inner'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              Live Bidding Room
            </span>
          </Link>

          <Link
            href="/foreman"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              pathname.startsWith('/foreman')
                ? 'bg-neutral-800 text-white shadow-inner'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Foreman Controls
            </span>
          </Link>

          <Link
            href="/audit"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              pathname.startsWith('/audit')
                ? 'bg-neutral-800 text-white shadow-inner'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Oversight Audit Log
            </span>
          </Link>
        </nav>

        {/* User Role Switcher Dropdown */}
        <div className="relative">
          {currentUser && (
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/30">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white">{currentUser.name}</span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${
                      currentUser.role === 'FOREMAN'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : currentUser.role === 'OVERSIGHT_VIEWER'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-400">
                  Trust Score: <span className="text-emerald-400 font-semibold">{currentUser.trustScore}</span> / 100
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          )}

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl p-2 z-50">
              <div className="px-3 py-2 border-b border-neutral-800/80 mb-1">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Switch Active Role (Coursework Demo)
                </p>
                <p className="text-[11px] text-neutral-500">Test different permissions and multi-bidding</p>
              </div>

              <div className="space-y-1">
                {allUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSwitchUser(user)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors ${
                      currentUser?.id === user.id
                        ? 'bg-neutral-800 text-white'
                        : 'hover:bg-neutral-800/60 text-neutral-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-medium">{user.name}</div>
                      <div className="text-[10px] text-neutral-400">
                        {user.role} • Trust: {user.trustScore}
                      </div>
                    </div>
                    {currentUser?.id === user.id && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
