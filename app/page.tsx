'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { CountdownTimer } from '@/components/bidding/countdown-timer';
import { LiveBidFeed, BidItem } from '@/components/bidding/live-bid-feed';
import { BidForm } from '@/components/bidding/bid-form';
import { DistributionChart } from '@/components/fraud/distribution-chart';
import { WinnerModal } from '@/components/bidding/winner-modal';
import { Coins, Users, Shield, Zap, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';

export default function BiddingRoomPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cycleData, setCycleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchCycle = useCallback(async (id?: string | null) => {
    try {
      let targetId = id || activeCycleId;
      if (!targetId) {
        const listRes = await fetch('/api/cycles');
        const listData = await listRes.json();
        targetId = listData.activeCycleId;
        setActiveCycleId(targetId);
      }

      if (!targetId) {
        setCycleData(null);
        return;
      }

      const res = await fetch(`/api/cycles/${targetId}`);
      if (!res.ok) {
        setCycleData(null);
        return;
      }
      const data = await res.json();
      setCycleData(data);
    } catch (err) {
      console.error('Error fetching cycle data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCycleId]);

  useEffect(() => {
    fetchCycle();
  }, [fetchCycle]);

  // Real-Time SSE Stream Subscription (FR19)
  useEffect(() => {
    if (!activeCycleId) return;

    const eventSource = new EventSource(`/api/cycles/${activeCycleId}/stream`);

    eventSource.addEventListener('NEW_BID', (e) => {
      try {
        const payload = JSON.parse(e.data);
        const newBid: BidItem = payload.bid;

        setCycleData((prev: any) => {
          if (!prev) return prev;
          const exists = prev.bids.some((b: BidItem) => b.id === newBid.id);
          const updatedBids = exists ? prev.bids : [...prev.bids, newBid];
          updatedBids.sort((a: BidItem, b: BidItem) => a.bidAmount - b.bidAmount);

          return { ...prev, bids: updatedBids };
        });

        if (payload.isAlert) {
          setToastMessage(`🚨 Flagged: Bid of ₹${newBid.bidAmount.toLocaleString('en-IN')} by ${newBid.memberName} under investigation.`);
        } else {
          setToastMessage(`⚡ New Bid: ₹${newBid.bidAmount.toLocaleString('en-IN')} by ${newBid.memberName}`);
        }

        setTimeout(() => setToastMessage(null), 4000);
      } catch (err) {
        console.error('Error parsing SSE bid:', err);
      }
    });

    eventSource.addEventListener('WINNER_DETERMINED', () => fetchCycle(activeCycleId));
    eventSource.addEventListener('CYCLE_SETTLED', () => fetchCycle(activeCycleId));
    eventSource.addEventListener('ALERT_RESOLVED', () => fetchCycle(activeCycleId));

    return () => {
      eventSource.close();
    };
  }, [activeCycleId, fetchCycle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // If no cycle is currently configured in the system
  if (!cycleData) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <Navbar onUserChange={(user) => setCurrentUser(user)} />
        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl">
            <Coins className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white">No Active Bidding Cycle</h2>
            <p className="text-xs text-neutral-400 mt-2">
              {currentUser?.role === 'FOREMAN'
                ? 'No chit group or cycle has been opened yet. Use the Foreman Command Center to approve members, create a chit fund group, and launch Cycle 1.'
                : 'Waiting for the Foreman to configure and open the next reverse-auction bidding window.'}
            </p>

            {currentUser?.role === 'FOREMAN' && (
              <div className="mt-6">
                <Link
                  href="/foreman"
                  className="inline-flex items-center space-x-2 py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
                >
                  <span>Open Foreman Controls</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  const { cycle, group, winner, enrolledMembers = [], bids = [] } = cycleData;

  const lowestOverallBid = bids[0];
  const isLowestBidBlockedByFraud =
    lowestOverallBid &&
    lowestOverallBid.status === 'FLAGGED_SUSPICIOUS' &&
    cycle.status !== 'BIDDING_OPEN';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Navbar onUserChange={(user) => setCurrentUser(user)} />

      {/* Real-time Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md p-3.5 rounded-2xl bg-neutral-900/95 border border-indigo-500/50 shadow-2xl backdrop-blur-md flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-5">
          <Zap className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
          <span className="font-semibold text-white">{toastMessage}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Chit Group & Active Cycle Header */}
        <div className="rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/80 to-indigo-950/40 border border-neutral-800 p-6 shadow-xl backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center space-x-2.5 mb-2">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs uppercase tracking-wider border border-indigo-500/30">
                  {group.name}
                </span>
                <span className="text-xs text-neutral-400">
                  Cycle #{cycle.cycleNumber} of {group.numberOfMembers}
                </span>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                    cycle.status === 'BIDDING_OPEN'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : cycle.status === 'SETTLED'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {cycle.status.replace('_', ' ')}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Live Reverse Auction & Fraud Guard
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
                Place competitive reverse-auction prize bids. The lowest valid bid claims the payout, and the remaining discount is distributed as dividends to enrolled members.
              </p>
            </div>

            {/* Metrics & Countdown Timer */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-3 px-4 py-2 rounded-2xl bg-neutral-950/60 border border-neutral-800">
                <Coins className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-neutral-400">Chit Pool Value</div>
                  <div className="font-mono font-bold text-sm text-white">
                    ₹{group.chitValue.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 px-4 py-2 rounded-2xl bg-neutral-950/60 border border-neutral-800">
                <Users className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-neutral-400">Enrolled Members</div>
                  <div className="font-mono font-bold text-sm text-white">
                    {enrolledMembers.length} / {group.numberOfMembers}
                  </div>
                </div>
              </div>

              <CountdownTimer
                endTime={cycle.biddingEndTime}
                durationSeconds={cycle.biddingDurationSeconds}
                status={cycle.status}
                onExpire={() => fetchCycle(activeCycleId)}
              />
            </div>
          </div>
        </div>

        {/* Member KYC Pending Alert */}
        {currentUser?.role === 'MEMBER' && currentUser?.kycStatus === 'PENDING' && (
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-center space-x-3 text-xs text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <strong className="font-bold">KYC Verification Pending: </strong>
              Your government identity submission is under review by the Foreman. You will be able to submit bids as soon as your KYC is approved.
            </div>
          </div>
        )}

        {/* Winner & Settlement Modal */}
        <WinnerModal
          cycleId={cycle.id}
          winner={winner}
          payoutAmount={cycle.payoutAmount}
          escrowStatus={cycle.escrowStatus}
          status={cycle.status}
          isLowestBidBlockedByFraud={isLowestBidBlockedByFraud}
          currentUserRole={currentUser?.role}
          onSettled={() => fetchCycle(activeCycleId)}
        />

        {/* 2-Column Workstation Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Bid Form & Anomaly Bell Curve */}
          <div className="lg:col-span-7 space-y-6">
            <BidForm
              cycleId={cycle.id}
              currentUser={currentUser}
              chitValue={group.chitValue}
              memberCount={group.numberOfMembers}
              status={cycle.status}
              onBidSubmitted={() => fetchCycle(activeCycleId)}
            />

            <DistributionChart
              mean={group.historicalMeanBid}
              stdDev={group.historicalSdBid}
              thresholdZ={group.fraudThresholdZ}
              bids={bids}
            />
          </div>

          {/* Right Column: Live Feed & Participants */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Live Bidding Feed
                  </h3>
                </div>
                <span className="text-xs font-mono text-neutral-400">
                  {bids.length} {bids.length === 1 ? 'Bid' : 'Bids'} Placed
                </span>
              </div>

              <LiveBidFeed bids={bids} />
            </div>

            {/* Enrolled Participants Roster */}
            <div className="rounded-2xl bg-neutral-900/40 border border-neutral-800/80 p-4">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" /> Enrolled Group Participants
              </h4>
              <div className="space-y-1.5">
                {enrolledMembers.map((member: any) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/60 text-xs"
                  >
                    <span className="font-medium text-neutral-200">{member.name}</span>
                    <span className="font-mono text-[11px] text-neutral-400">
                      Trust: <strong className="text-white">{member.trustScore}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
