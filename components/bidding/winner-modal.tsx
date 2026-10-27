'use client';

import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, CheckCircle, ShieldAlert, Award, FileCheck2, Loader2, ArrowRight } from 'lucide-react';

interface WinnerModalProps {
  cycleId: string;
  winner: { id: string; name: string; email: string } | null;
  payoutAmount: number | null;
  escrowStatus: string;
  status: string;
  isLowestBidBlockedByFraud?: boolean;
  currentUserRole?: string;
  onSettled?: (receipt: string) => void;
}

export function WinnerModal({
  cycleId,
  winner,
  payoutAmount,
  escrowStatus,
  status,
  isLowestBidBlockedByFraud,
  currentUserRole,
  onSettled,
}: WinnerModalProps) {
  const [settling, setSettling] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'BIDDING_CLOSED' && winner) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  }, [status, winner]);

  if (status !== 'BIDDING_CLOSED' && status !== 'SETTLED' && status !== 'DISPUTED') {
    return null;
  }

  async function handleSettlePayout() {
    setSettling(true);
    setError(null);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Settlement failed');

      setReceipt(data.receiptId);
      onSettled?.(data.receiptId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSettling(false);
    }
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-950/40 via-neutral-900 to-indigo-950/40 border border-amber-500/40 p-6 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-lg shadow-amber-500/20">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold text-amber-400 tracking-wider">
                Cycle Closed • Winner Determined
              </span>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                  escrowStatus === 'RELEASED'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : escrowStatus === 'HELD_FOR_REVIEW'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                Escrow: {escrowStatus}
              </span>
            </div>

            <h2 className="text-xl font-extrabold text-white mt-1">
              {winner ? winner.name : 'Cycle Under Dispute'}
            </h2>

            {payoutAmount && (
              <p className="text-xs text-neutral-300 mt-0.5">
                Winning Prize Claim:{' '}
                <span className="font-mono font-bold text-amber-300">
                  ₹{payoutAmount.toLocaleString('en-IN')}
                </span>{' '}
                • Total Dividend Distributed: ₹{(100000 - payoutAmount).toLocaleString('en-IN')}
              </p>
            )}
          </div>
        </div>

        {/* Payout Settlement CTA */}
        <div>
          {escrowStatus === 'RELEASED' ? (
            <div className="px-4 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Payout Settled & Released</span>
            </div>
          ) : escrowStatus === 'HELD_FOR_REVIEW' ? (
            <div className="px-4 py-2 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Escrow Held for Fraud Triage</span>
            </div>
          ) : (
            <button
              onClick={handleSettlePayout}
              disabled={settling}
              className="flex items-center space-x-2 py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {settling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileCheck2 className="w-4 h-4" />
              )}
              <span>{settling ? 'Settling Escrow...' : 'Release Escrow Payout (Foreman)'}</span>
            </button>
          )}
        </div>
      </div>

      {isLowestBidBlockedByFraud && (
        <div className="mt-4 p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 flex items-start space-x-3 text-xs text-rose-200">
          <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-bold">Fraud Layer Protection Active (FR21 / FT-16):</span> A lower bid was received, but was flagged as an abnormal underbid anomaly ($Z &gt; 2.5\sigma$). In accordance with PRD winner determination rules, the system bypassed the suspicious bid and awarded the cycle to the lowest <em>valid</em> bid.
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/50 text-xs text-rose-300">
          {error}
        </div>
      )}

      {receipt && (
        <div className="mt-3 p-3 rounded-xl bg-neutral-950 border border-emerald-500/30 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-neutral-500 block">
              Digitally Signed Settlement Receipt (FR28)
            </span>
            <span className="font-mono text-emerald-400 font-semibold">{receipt}</span>
          </div>
          <span className="text-[10px] text-neutral-400">Cryptographically Signed</span>
        </div>
      )}
    </div>
  );
}
