'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/navbar';
import { ShieldCheck, AlertOctagon, CheckCircle2, XCircle, Sliders, RefreshCw, UserCheck } from 'lucide-react';

export default function ForemanDashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cycleData, setCycleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function loadData() {
    try {
      const listRes = await fetch('/api/cycles');
      const listData = await listRes.json();
      const activeId = listData.activeCycleId;
      if (!activeId) return;

      const res = await fetch(`/api/cycles/${activeId}`);
      const data = await res.json();
      setCycleData(data);
    } catch (err) {
      console.error('Error loading foreman data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleOverride(alertId: string, action: 'OVERRIDDEN' | 'DISQUALIFIED') {
    setActionLoading(alertId);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/fraud/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId,
          action,
          foremanId: currentUser?.id,
          reason: action === 'OVERRIDDEN' ? 'Foreman verified legitimate underbid' : 'Foreman confirmed collusive anomaly',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update alert');

      setStatusMsg(`Alert marked as ${action}! Bid status adjusted accordingly.`);
      await loadData();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading || !cycleData) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  const { cycle, group, alerts = [], enrolledMembers } = cycleData;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Navbar onUserChange={(user) => setCurrentUser(user)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-amber-950/30 border border-neutral-800 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center space-x-3 mb-2">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs uppercase tracking-wider border border-amber-500/30 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Foreman Command Center
            </span>
            <span className="text-xs text-neutral-400">Chit: {group.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Fraud Alert Triage & Cycle Governance
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
            Review in-line statistical anomaly flags, adjudicate flagged bids, and manage cycle parameters.
          </p>
        </div>

        {statusMsg && (
          <div className="p-3.5 rounded-2xl bg-neutral-900 border border-indigo-500/40 text-xs font-mono text-indigo-200">
            {statusMsg}
          </div>
        )}

        {/* Section 1: Active Fraud Alerts (FR26) */}
        <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertOctagon className="w-5 h-5 text-rose-500" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Flagged Anomaly Triage (FR24 & FR26)
              </h2>
            </div>
            <span className="text-xs font-mono text-neutral-400">
              {alerts.length} Total Alerts Logged
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-neutral-950/40 border border-neutral-800">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-medium text-neutral-300">
                No active fraud alerts detected for this cycle. All bids have complied with statistical thresholds.
              </p>
              <p className="text-[11px] text-neutral-500 mt-1">
                You can trigger a demo underbid via the Simulator on the Bidding Room page.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className="p-4 rounded-xl bg-neutral-950/80 border border-rose-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-white">{alert.memberName}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {alert.ruleViolated}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500">
                        {new Date(alert.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-rose-200">{alert.details}</p>
                    {alert.resolved && (
                      <span className="inline-block text-[10px] uppercase font-bold text-emerald-400">
                        Resolution: {alert.resolutionAction}
                      </span>
                    )}
                  </div>

                  {!alert.resolved && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOverride(alert.id, 'OVERRIDDEN')}
                        disabled={actionLoading === alert.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Override & Allow</span>
                      </button>

                      <button
                        onClick={() => handleOverride(alert.id, 'DISQUALIFIED')}
                        disabled={actionLoading === alert.id}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-all flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Disqualify Bid</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Group Statistical Parameters & Governance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <div className="text-[10px] font-bold uppercase text-neutral-400">Historical Mean ($\mu$)</div>
            <div className="text-xl font-bold font-mono text-white">
              ₹{group.historicalMeanBid.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-neutral-500">
              Computed from verified bids across completed cycles.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <div className="text-[10px] font-bold uppercase text-neutral-400">Standard Deviation ($\sigma$)</div>
            <div className="text-xl font-bold font-mono text-white">
              ₹{group.historicalSdBid.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-neutral-500">
              Volatility bound for reverse auction discounts.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <div className="text-[10px] font-bold uppercase text-neutral-400">Anomaly Threshold ($Z$)</div>
            <div className="text-xl font-bold font-mono text-indigo-400">
              {group.fraudThresholdZ} Standard Deviations
            </div>
            <p className="text-[11px] text-neutral-500">
              Cutoff point: Bids below ₹{(group.historicalMeanBid - group.fraudThresholdZ * group.historicalSdBid).toLocaleString('en-IN')} are auto-flagged.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
