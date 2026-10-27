'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, Gavel, FileSpreadsheet, Activity, LogOut, User } from 'lucide-react';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'MEMBER' | 'FOREMAN' | 'OVERSIGHT_VIEWER';
  kycStatus: string;
  trustScore: number;
}

export function Navbar({ onUserChange }: { onUserChange?: (user: AuthUser | null) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetchSession();
  }, []);

  async function fetchSession() {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.currentUser) {
        setCurrentUser(data.currentUser);
        onUserChange?.(data.currentUser);
      } else {
        setCurrentUser(null);
        onUserChange?.(null);
      }
    } catch (err) {
      console.error('Failed to fetch session', err);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  const isForeman = currentUser?.role === 'FOREMAN';
  const isAuditor = currentUser?.role === 'OVERSIGHT_VIEWER';

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

        {/* Role-Protected Navigation Links */}
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
              Bidding Room
            </span>
          </Link>

          {isForeman && (
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
          )}

          {(isForeman || isAuditor) && (
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
                Audit Log
              </span>
            </Link>
          )}
        </nav>

        {/* Authenticated User Profile & Sign Out */}
        <div className="flex items-center space-x-3">
          {currentUser ? (
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex flex-col text-right">
                <div className="flex items-center justify-end space-x-1.5">
                  <span className="text-xs font-semibold text-white">{currentUser.name}</span>
                  <span
                    className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${
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
                <div className="text-[10px] text-neutral-400 flex items-center justify-end gap-1.5">
                  <span>
                    KYC:{' '}
                    <strong
                      className={
                        currentUser.kycStatus === 'VERIFIED'
                          ? 'text-emerald-400'
                          : currentUser.kycStatus === 'PENDING'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }
                    >
                      {currentUser.kycStatus}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>Trust: {currentUser.trustScore}</span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 rounded-xl bg-neutral-900 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-300 border border-neutral-800 hover:border-rose-500/30 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
