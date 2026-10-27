'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/navbar';
import { FileSpreadsheet, ShieldCheck, Download, RefreshCw, CheckCircle2, AlertTriangle, Key, Lock } from 'lucide-react';

export default function AuditLogPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [integrity, setIntegrity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  async function loadLogs() {
    setLoading(true);
    try {
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();
      setCurrentUser(sessionData.currentUser);
      setAuthChecked(true);

      if (sessionData.currentUser?.role !== 'FOREMAN' && sessionData.currentUser?.role !== 'OVERSIGHT_VIEWER') {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/audit');
      const data = await res.json();
      setLogs(data.logs || []);
      setIntegrity(data.integrity || null);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  async function handleVerify() {
    setVerifying(true);
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      setIntegrity(data.integrity);
    } catch (err) {
      console.error('Verification failed', err);
    } finally {
      setVerifying(false);
    }
  }

  function handleExport() {
    window.open('/api/audit/export', '_blank');
  }

  if (authChecked && currentUser?.role !== 'FOREMAN' && currentUser?.role !== 'OVERSIGHT_VIEWER') {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <Navbar />
        <div className="max-w-md mx-auto mt-20 p-8 rounded-3xl bg-neutral-900 border border-rose-500/30 text-center">
          <Lock className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white">403 Access Denied</h2>
          <p className="text-xs text-neutral-400 mt-2">
            The cryptographic audit log is restricted to Foreman and Oversight Viewer roles. Members do not have authorization to view system-wide transaction ledgers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Navbar onUserChange={(user) => setCurrentUser(user)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-purple-950/30 border border-neutral-800 p-6 shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-400 font-bold text-xs uppercase tracking-wider border border-purple-500/30 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Oversight Viewer Ledger
                </span>
                <span className="text-xs text-neutral-400">NFR09 & NFR13 Audit Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Immutable SHA-256 Audit Trail
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
                Every state transition, submitted bid, fraud flag, and payout release is cryptographically chained for tamper-evident auditing.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 transition-all flex items-center gap-2"
              >
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>{verifying ? 'Verifying Chain...' : 'Verify Cryptographic Chain'}</span>
              </button>

              <button
                onClick={handleExport}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Signed CSV (FR34)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Cryptographic Chain Integrity Status Banner */}
        {integrity && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              integrity.valid
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              {integrity.valid ? (
                <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0" />
              )}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  {integrity.valid ? 'Cryptographic Integrity Verified' : 'Chain Corruption Detected'}
                </h4>
                <p className="text-xs text-neutral-300 mt-0.5">{integrity.message}</p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800">
              {integrity.totalEntries} Chained Entries
            </span>
          </div>
        )}

        {/* Audit Log Table */}
        <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-neutral-800/80 flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Recorded Blockchain-Style Audit Ledger
            </h3>
            <button
              onClick={loadLogs}
              className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/80 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Entry Hash (SHA-256)</th>
                  <th className="py-3 px-4">Previous Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono">
                {logs.map((log) => {
                  const isFraud = log.action.includes('FRAUD') || log.action.includes('DISPUTED');
                  const isSettled = log.action.includes('SETTLED') || log.action.includes('RELEASED');

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-neutral-800/30 transition-colors ${
                        isFraud ? 'bg-rose-950/10' : isSettled ? 'bg-emerald-950/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-neutral-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-sans font-semibold text-white">
                          {log.actorName || 'System'}
                        </span>{' '}
                        <span className="text-[10px] text-neutral-500 font-mono">({log.actorRole})</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isFraud
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isSettled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-neutral-800 text-neutral-300'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-400 whitespace-nowrap">
                        {log.entityType}
                      </td>
                      <td className="py-3 px-4 text-indigo-400 whitespace-nowrap text-[11px]">
                        {log.entryHash.slice(0, 16)}...
                      </td>
                      <td className="py-3 px-4 text-neutral-500 whitespace-nowrap text-[11px]">
                        {log.previousHash ? `${log.previousHash.slice(0, 12)}...` : '000000000000...'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
