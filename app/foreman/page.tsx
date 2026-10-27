'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import {
  ShieldCheck,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Users,
  PlusCircle,
  Play,
  Square,
  Clock,
  Timer,
  Coins,
  RefreshCw,
  Lock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export default function ForemanDashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<'triage' | 'kyc' | 'create_group' | 'launch_cycle'>('kyc');

  const [members, setMembers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [cycleData, setCycleData] = useState<any>(null);
  const [allCycles, setAllCycles] = useState<any[]>([]);
  const [activeCycles, setActiveCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Group creation form state
  const [groupForm, setGroupForm] = useState({
    name: 'Gold Wealth Chit 2026',
    chitValue: '100000',
    numberOfMembers: '5',
    cycleDurationDays: '30',
    fraudThresholdZ: '2.5',
    selectedMemberIds: [] as string[],
  });

  // Cycle launch state
  const [cycleDurationSeconds, setCycleDurationSeconds] = useState('180');

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      // 1. Session check
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();
      setCurrentUser(sessionData.currentUser);
      setAuthChecked(true);

      if (sessionData.currentUser?.role !== 'FOREMAN') {
        setLoading(false);
        return;
      }

      // 2. Load Members
      const kycRes = await fetch('/api/foreman/kyc');
      const kycData = await kycRes.json();
      setMembers(kycData.members || []);

      // 3. Load Groups
      const groupsRes = await fetch('/api/foreman/groups');
      const groupsData = await groupsRes.json();
      setGroups(groupsData.groups || []);

      // 4. Load All and Active Cycles
      const cyclesRes = await fetch('/api/cycles');
      const cyclesData = await cyclesRes.json();
      setAllCycles(cyclesData.cycles || []);
      setActiveCycles(cyclesData.activeCycles || []);

      const targetCycleId = cyclesData.activeCycleId || cyclesData.cycles?.[0]?.id;
      if (targetCycleId) {
        const cycleRes = await fetch(`/api/cycles/${targetCycleId}`);
        const cycleJson = await cycleRes.json();
        setCycleData(cycleJson);
      }
    } catch (err: any) {
      console.error('Error loading foreman dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle Extend Timer (FR18)
  async function handleExtendTimer(cycleId: string, extraSeconds: number) {
    try {
      const res = await fetch(`/api/foreman/cycles/${cycleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extend_timer', extraSeconds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extend timer');

      setMsg({
        type: 'success',
        text: `Extended Cycle #${data.cycle.cycleNumber} bidding window by +${extraSeconds}s.`,
      });
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  // Handle Force Stop Cycle (FR18)
  async function handleStopCycle(cycleId: string) {
    if (!confirm('Are you sure you want to stop this bidding cycle now? This will finalize the auction immediately.')) {
      return;
    }
    try {
      const res = await fetch(`/api/foreman/cycles/${cycleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_cycle' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to stop cycle');

      const winnerText = data.winner?.name ? `Winning Member: ${data.winner.name}` : 'Disputed (no valid bids placed)';
      setMsg({
        type: 'success',
        text: `Cycle #${data.cycle.cycleNumber} stopped by Foreman. ${winnerText}`,
      });
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  // Handle KYC Action
  async function handleKycAction(memberId: string, action: 'APPROVE' | 'REJECT') {
    let rejectionReason = '';
    if (action === 'REJECT') {
      rejectionReason = prompt('Enter mandatory rejection reason:') || '';
      if (!rejectionReason.trim()) return;
    }

    try {
      const res = await fetch('/api/foreman/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, action, rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      setMsg({ type: 'success', text: `Member KYC ${action === 'APPROVE' ? 'Approved' : 'Rejected'} successfully.` });
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  // Handle Create Chit Group
  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/foreman/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupForm.name,
          chitValue: groupForm.chitValue,
          numberOfMembers: groupForm.numberOfMembers,
          cycleDurationDays: groupForm.cycleDurationDays,
          fraudThresholdZ: groupForm.fraudThresholdZ,
          memberIds: groupForm.selectedMemberIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create group');

      setMsg({ type: 'success', text: `Chit Group "${groupForm.name}" created with ${groupForm.selectedMemberIds.length} members enrolled.` });
      setActiveTab('launch_cycle');
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  // Handle Launch Cycle
  async function handleLaunchCycle(groupId: string) {
    try {
      const res = await fetch('/api/foreman/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          durationSeconds: parseInt(cycleDurationSeconds) || 180,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start cycle');

      setMsg({ type: 'success', text: `Cycle #${data.cycle.cycleNumber} opened with ${cycleDurationSeconds}s timer!` });
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  // Handle Fraud Alert Adjudication
  async function handleOverride(alertId: string, action: 'OVERRIDDEN' | 'DISQUALIFIED') {
    try {
      const res = await fetch('/api/fraud/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId,
          action,
          foremanId: currentUser?.id,
          reason: action === 'OVERRIDDEN' ? 'Foreman approved legitimate low bid' : 'Foreman confirmed collusive underbid',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Override failed');

      setMsg({ type: 'success', text: `Alert marked as ${action}. Bid status updated.` });
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  // Access Control Guard
  if (authChecked && currentUser?.role !== 'FOREMAN') {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <Navbar />
        <div className="max-w-md mx-auto mt-20 p-8 rounded-3xl bg-neutral-900 border border-rose-500/30 text-center">
          <Lock className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white">403 Access Denied</h2>
          <p className="text-xs text-neutral-400 mt-2">
            This module requires Foreman privileges. You are currently authenticated as{' '}
            <strong className="text-white">{currentUser?.name || 'Guest'}</strong> ({currentUser?.role}).
          </p>
        </div>
      </div>
    );
  }

  const alerts = cycleData?.alerts || [];
  const verifiedMembers = members.filter((m) => m.kycStatus === 'VERIFIED');

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
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Chit Group Operations & Fraud Triage
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
            Manage member KYC approvals, configure and launch live bidding cycles, and review statistical anomaly alerts.
          </p>
        </div>

        {msg && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-mono flex items-center justify-between ${
              msg.type === 'success'
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
            }`}
          >
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-3">
          <button
            onClick={() => setActiveTab('kyc')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'kyc'
                ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20 font-bold'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Member KYC Approvals ({members.filter((m) => m.kycStatus === 'PENDING').length} Pending)
          </button>

          <button
            onClick={() => setActiveTab('create_group')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'create_group'
                ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20 font-bold'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Create Chit Group ({groups.length} Existing)
          </button>

          <button
            onClick={() => setActiveTab('launch_cycle')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'launch_cycle'
                ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20 font-bold'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Launch & Supervise Cycles {activeCycles.length > 0 ? `(${activeCycles.length} Live)` : ''}
          </button>

          <button
            onClick={() => setActiveTab('triage')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'triage'
                ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20 font-bold'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Fraud Alerts ({alerts.filter((a: any) => !a.resolved).length} Active)
          </button>
        </div>

        {/* TAB 1: KYC Approvals */}
        {activeTab === 'kyc' && (
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Member KYC Verification Requests (FR04)
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Review government IDs uploaded by registered members before allowing live bids.
                </p>
              </div>
            </div>

            {members.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-neutral-950/40 border border-neutral-800 text-xs text-neutral-400">
                No members have registered yet. Once members register on the Register page, they will appear here.
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/80 rounded-xl bg-neutral-950/60 border border-neutral-800 overflow-hidden">
                {members.map((member) => (
                  <div key={member.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-white">{member.name}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            member.kycStatus === 'VERIFIED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : member.kycStatus === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {member.kycStatus}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400 font-mono mt-1 space-x-3">
                        <span>Email: {member.email}</span>
                        <span>•</span>
                        <span>Mobile: {member.mobile}</span>
                        <span>•</span>
                        <span>Govt ID: <strong className="text-neutral-200">{member.govtId}</strong></span>
                      </div>
                    </div>

                    {member.kycStatus === 'PENDING' && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleKycAction(member.id, 'APPROVE')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve KYC
                        </button>
                        <button
                          onClick={() => handleKycAction(member.id, 'REJECT')}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md shadow-rose-600/20"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Create Chit Group */}
        {activeTab === 'create_group' && (
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-6 space-y-5">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Create New Chit Fund Group (FR06 & FR07)
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Configure pool value, duration, and enroll KYC-verified members.
              </p>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Chit Pool Value (₹)</label>
                  <input
                    type="number"
                    step="1000"
                    required
                    value={groupForm.chitValue}
                    onChange={(e) => setGroupForm({ ...groupForm, chitValue: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2 px-3 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Number of Members</label>
                  <input
                    type="number"
                    min="2"
                    required
                    value={groupForm.numberOfMembers}
                    onChange={(e) => setGroupForm({ ...groupForm, numberOfMembers: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2 px-3 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Enroll Verified Members ({groupForm.selectedMemberIds.length} Selected)
                </label>
                {verifiedMembers.length === 0 ? (
                  <p className="text-xs text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/30">
                    No KYC-verified members found. Approve members in the "Member KYC Approvals" tab first.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                    {verifiedMembers.map((m) => {
                      const isSelected = groupForm.selectedMemberIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className="flex items-center space-x-2.5 p-2 rounded-lg hover:bg-neutral-900 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setGroupForm({ ...groupForm, selectedMemberIds: [...groupForm.selectedMemberIds, m.id] });
                              } else {
                                setGroupForm({
                                  ...groupForm,
                                  selectedMemberIds: groupForm.selectedMemberIds.filter((id) => id !== m.id),
                                });
                              }
                            }}
                            className="rounded border-neutral-700 text-amber-500 focus:ring-0"
                          />
                          <span className="font-medium text-white">{m.name}</span>
                          <span className="text-neutral-500 font-mono">({m.email})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
              >
                Create Chit Group
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: Launch & Supervise Cycles */}
        {activeTab === 'launch_cycle' && (
          <div className="space-y-6">
            {/* 1. Live Active Bidding Sessions (FR18) */}
            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Live Active Bidding Sessions ({activeCycles.length} Live)
                    </h2>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Supervise ongoing reverse auctions in real-time. Extend timers or stop cycles manually.
                  </p>
                </div>
              </div>

              {activeCycles.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-neutral-950/40 border border-neutral-800 text-xs text-neutral-400">
                  No cycles currently active. Launch a new cycle below to open a bidding window.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeCycles.map((ac) => (
                    <div
                      key={ac.id}
                      className="p-5 rounded-2xl bg-neutral-950/90 border border-emerald-500/40 shadow-lg shadow-emerald-500/5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-white">{ac.groupName}</span>
                            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Cycle #{ac.cycleNumber}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Bidding Open
                            </span>
                          </div>
                          <div className="text-xs text-neutral-400 font-mono mt-1 space-x-3">
                            <span>Pool: ₹{ac.chitValue.toLocaleString('en-IN')}</span>
                            <span>•</span>
                            <span>Ends: {ac.biddingEndTime ? new Date(ac.biddingEndTime).toLocaleTimeString() : 'N/A'}</span>
                            <span>•</span>
                            <span>Duration: {ac.biddingDurationSeconds}s</span>
                          </div>
                        </div>

                        <Link
                          href={`/cycle/${ac.id}`}
                          className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md"
                        >
                          <span>Enter Live Room</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>

                      {/* Foreman Controls for this active cycle */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1">
                            <Timer className="w-3.5 h-3.5 text-amber-400" /> Extend Timer:
                          </span>
                          <button
                            onClick={() => handleExtendTimer(ac.id, 60)}
                            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold transition-all"
                            title="Add 60 seconds to countdown"
                          >
                            +60s
                          </button>
                          <button
                            onClick={() => handleExtendTimer(ac.id, 120)}
                            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold transition-all"
                            title="Add 120 seconds to countdown"
                          >
                            +120s
                          </button>
                        </div>

                        <div>
                          <button
                            onClick={() => handleStopCycle(ac.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span>Stop Bidding Window</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Launch New Bidding Cycle (FR17) */}
            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-6 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Launch New Bidding Cycle (FR17)
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Opens a new countdown reverse-auction window for enrolled chit group members.
                </p>
              </div>

              {groups.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-neutral-950/40 border border-neutral-800 text-xs text-neutral-400">
                  No chit groups created yet. Create a group in the "Create Chit Group" tab first.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 max-w-xs">
                    <label className="text-xs font-semibold text-neutral-300">Countdown Timer (Seconds):</label>
                    <input
                      type="number"
                      min="30"
                      step="30"
                      value={cycleDurationSeconds}
                      onChange={(e) => setCycleDurationSeconds(e.target.value)}
                      className="w-24 bg-neutral-950 border border-neutral-800 rounded-xl py-1.5 px-3 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="divide-y divide-neutral-800 rounded-xl bg-neutral-950/60 border border-neutral-800 overflow-hidden">
                    {groups.map((group) => {
                      const isGroupActive = activeCycles.some((ac) => ac.groupId === group.id);
                      return (
                        <div key={group.id} className="p-4 flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-bold text-white">{group.name}</span>
                              {isGroupActive && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Live Cycle Active
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neutral-400 font-mono mt-0.5 space-x-3">
                              <span>Pool: ₹{group.chitValue.toLocaleString('en-IN')}</span>
                              <span>•</span>
                              <span>Capacity: {group.numberOfMembers} Members</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleLaunchCycle(group.id)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-neutral-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                          >
                            <Play className="w-3.5 h-3.5" /> Open Bidding Window
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Concluded Cycles History */}
            {allCycles.filter((c) => c.status !== 'BIDDING_OPEN').length > 0 && (
              <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-6 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Past & Concluded Cycles History
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Records of finalized auctions, winning payouts, and escrow dispositions.
                  </p>
                </div>

                <div className="divide-y divide-neutral-800 rounded-xl bg-neutral-950/60 border border-neutral-800 overflow-hidden">
                  {allCycles
                    .filter((c) => c.status !== 'BIDDING_OPEN')
                    .map((c) => (
                      <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-white">{c.groupName}</span>
                            <span className="text-xs font-mono font-semibold px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300">
                              Cycle #{c.cycleNumber}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                                c.status === 'SETTLED'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                  : c.status === 'BIDDING_CLOSED'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {c.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-400 font-mono mt-1 space-x-3">
                            <span>Winner: <strong className="text-neutral-200">{c.winnerName || 'Disputed'}</strong></span>
                            <span>•</span>
                            <span>Payout: <strong className="text-white">₹{c.payoutAmount ? c.payoutAmount.toLocaleString('en-IN') : '0'}</strong></span>
                            <span>•</span>
                            <span>Escrow: {c.escrowStatus}</span>
                          </div>
                        </div>

                        <Link
                          href={`/cycle/${c.id}`}
                          className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-all flex items-center gap-1.5"
                        >
                          <span>View Room</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Fraud Alerts */}
        {activeTab === 'triage' && (
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-6 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Statistical Anomaly Alerts (FR24 & FR26)
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Bids flagged by statistical Z-Score underbid analysis or collusion frequency checks.
              </p>
            </div>

            {alerts.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-neutral-950/40 border border-neutral-800 text-xs text-neutral-400">
                No active fraud alerts. All submitted bids currently comply with statistical bounds.
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
                    </div>

                    {!alert.resolved && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleOverride(alert.id, 'OVERRIDDEN')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-all flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Override & Allow
                        </button>
                        <button
                          onClick={() => handleOverride(alert.id, 'DISQUALIFIED')}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-all flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Disqualify Bid
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
