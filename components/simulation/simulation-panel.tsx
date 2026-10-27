'use client';

import React, { useState } from 'react';
import { Users, AlertTriangle, RotateCcw, FastForward, CheckCircle, Loader2 } from 'lucide-react';

interface SimulationPanelProps {
  cycleId: string;
  onActionComplete?: () => void;
}

export function SimulationPanel({ cycleId, onActionComplete }: SimulationPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSimulate(mode: 'concurrent_bids' | 'fraud_underbid' | 'reset_cycle') {
    setLoading(mode);
    setFeedback(null);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Simulation failed');

      if (mode === 'concurrent_bids') {
        setFeedback('⚡ 3 Concurrent Bids placed across members (₹81k, ₹78.5k, ₹77k)!');
      } else if (mode === 'fraud_underbid') {
        setFeedback('🚨 Abnormal underbid (₹60,000) submitted! Evaluated as Z = 6.25 and flagged.');
      } else if (mode === 'reset_cycle') {
        setFeedback('🔄 Cycle 2 window refreshed with 180s timer!');
      }

      onActionComplete?.();
    } catch (err: any) {
      setFeedback(`❌ Error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  }

  async function handleCloseWindow() {
    setLoading('close');
    setFeedback(null);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/close`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to close window');

      if (data.status === 'DISPUTED') {
        setFeedback('⚠️ Cycle closed into DISPUTE: All bids were flagged as anomalies!');
      } else if (data.winner) {
        setFeedback(`🏆 Winner determined: ${data.winner.name} with lowest valid bid ₹${data.winningBid.bidAmount.toLocaleString('en-IN')}`);
      }
      onActionComplete?.();
    } catch (err: any) {
      setFeedback(`❌ Error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-neutral-900/90 to-neutral-950 border border-indigo-500/30 p-5 shadow-xl shadow-indigo-950/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Coursework Demo & Multi-Bidder Simulator
          </h3>
        </div>
        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
          Evaluation Toolkit
        </span>
      </div>

      <p className="text-xs text-neutral-400 mb-4">
        Test high-concurrency bidding, reverse-auction race conditions, and statistical anomaly triggers with one click.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Button 1: Simulate Concurrent Bidders */}
        <button
          onClick={() => handleSimulate('concurrent_bids')}
          disabled={!!loading}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-indigo-500/50 transition-all text-center group disabled:opacity-50"
        >
          {loading === 'concurrent_bids' ? (
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin mb-1" />
          ) : (
            <Users className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform mb-1" />
          )}
          <span className="text-xs font-semibold text-neutral-200">Simulate 3 Bidders</span>
          <span className="text-[10px] text-neutral-500 mt-0.5">Place concurrent bids</span>
        </button>

        {/* Button 2: Trigger PRD Fraud Case */}
        <button
          onClick={() => handleSimulate('fraud_underbid')}
          disabled={!!loading}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-neutral-900 hover:bg-rose-950/30 border border-neutral-800 hover:border-rose-500/50 transition-all text-center group disabled:opacity-50"
        >
          {loading === 'fraud_underbid' ? (
            <Loader2 className="w-5 h-5 text-rose-400 animate-spin mb-1" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform mb-1" />
          )}
          <span className="text-xs font-semibold text-rose-300">Trigger Fraud Underbid</span>
          <span className="text-[10px] text-neutral-500 mt-0.5">Test FT-15 (₹60,000)</span>
        </button>

        {/* Button 3: Close Window & Pick Winner */}
        <button
          onClick={handleCloseWindow}
          disabled={!!loading}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-neutral-900 hover:bg-amber-950/30 border border-neutral-800 hover:border-amber-500/50 transition-all text-center group disabled:opacity-50"
        >
          {loading === 'close' ? (
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin mb-1" />
          ) : (
            <FastForward className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform mb-1" />
          )}
          <span className="text-xs font-semibold text-amber-300">Close Window Now</span>
          <span className="text-[10px] text-neutral-500 mt-0.5">Determine Winner</span>
        </button>

        {/* Button 4: Reset Demo Cycle */}
        <button
          onClick={() => handleSimulate('reset_cycle')}
          disabled={!!loading}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-emerald-500/50 transition-all text-center group disabled:opacity-50"
        >
          {loading === 'reset_cycle' ? (
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mb-1" />
          ) : (
            <RotateCcw className="w-5 h-5 text-emerald-400 group-hover:rotate-45 transition-transform mb-1" />
          )}
          <span className="text-xs font-semibold text-emerald-300">Reset Demo Cycle</span>
          <span className="text-[10px] text-neutral-500 mt-0.5">Start fresh 180s</span>
        </button>
      </div>

      {feedback && (
        <div className="mt-3.5 p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-300 flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
}
