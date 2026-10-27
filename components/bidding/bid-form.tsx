'use client';

import React, { useState } from 'react';
import { Send, AlertCircle, Info, ShieldAlert } from 'lucide-react';

interface BidFormProps {
  cycleId: string;
  currentUser: {
    id: string;
    name: string;
    role: string;
    kycStatus: string;
    trustScore: number;
  } | null;
  chitValue: number;
  memberCount: number;
  status: string;
  lowestBid?: { memberId: string; bidAmount: number } | null;
  onBidSubmitted?: (data: any) => void;
}

export function BidForm({
  cycleId,
  currentUser,
  chitValue = 100000,
  memberCount = 5,
  status,
  lowestBid,
  onBidSubmitted,
}: BidFormProps) {
  const [bidAmount, setBidAmount] = useState<string>('85000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSubmittedFraud, setLastSubmittedFraud] = useState<any | null>(null);

  const numericBid = parseFloat(bidAmount) || 0;
  const discount = Math.max(0, chitValue - numericBid);
  const dividendPerMember = memberCount > 0 ? discount / memberCount : 0;
  const baseMonthlyContribution = chitValue / memberCount;
  const netMonthlyDue = Math.max(0, baseMonthlyContribution - dividendPerMember);

  const isEligible = currentUser?.role === 'MEMBER' && currentUser?.kycStatus === 'VERIFIED';
  const isWindowOpen = status === 'BIDDING_OPEN';
  const isCurrentLowestBidder = lowestBid && currentUser && lowestBid.memberId === currentUser.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !isEligible || !isWindowOpen) return;

    if (numericBid <= 0 || numericBid > chitValue) {
      setError(`Bid amount must be between ₹1 and ₹${chitValue.toLocaleString('en-IN')}`);
      return;
    }

    setLoading(true);
    setError(null);
    setLastSubmittedFraud(null);

    try {
      const res = await fetch(`/api/cycles/${cycleId}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: currentUser.id,
          bidAmount: numericBid,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit bid');
      }

      if (data.fraudCheck?.isAnomaly) {
        setLastSubmittedFraud(data.fraudCheck);
      }

      onBidSubmitted?.(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Submit Reverse Auction Bid</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
              Chit: ₹{chitValue.toLocaleString('en-IN')}
            </span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Lowest valid bid wins the prize payout; the discount is distributed as dividend.
          </p>
        </div>
      </div>

      {!isWindowOpen ? (
        <div className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/60 text-center">
          <p className="text-xs font-semibold text-neutral-400">
            Bidding window is not active. Waiting for next cycle or window closure.
          </p>
        </div>
      ) : !isEligible ? (
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start space-x-3">
          <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-200">
            {currentUser?.role === 'FOREMAN' ? (
              <span>
                <strong>Foreman Observer View:</strong> Foremen manage groups and review bids, but cannot participate as bidding members. Log in as an enrolled member to submit live bids.
              </span>
            ) : currentUser?.kycStatus === 'PENDING' ? (
              <span>
                <strong>KYC Approval Required:</strong> Your KYC verification is pending review by the Foreman. You will be eligible to bid once verified.
              </span>
            ) : (
              <span>
                <strong>Enrollment Required:</strong> You must be an enrolled and KYC-verified member of this chit group to submit bids.
              </span>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Bid Amount (Prize Claim in ₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-neutral-400 text-sm">
                ₹
              </span>
              <input
                type="number"
                step="500"
                min="1000"
                max={chitValue}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="e.g. 82000"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2.5 pl-8 pr-4 text-white font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Live Reverse Auction Math Breakdown */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 text-center">
            <div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Discount Offered</div>
              <div className="text-xs font-mono font-bold text-indigo-400 mt-0.5">
                ₹{discount.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Dividend / Member</div>
              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                ₹{dividendPerMember.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Net Monthly Due</div>
              <div className="text-xs font-mono font-bold text-neutral-200 mt-0.5">
                ₹{netMonthlyDue.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {lastSubmittedFraud && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/60 space-y-1">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Bid Under Review by Fraud Layer</span>
              </div>
              <p className="text-[11px] text-rose-200">{lastSubmittedFraud.details}</p>
            </div>
          )}

          {isCurrentLowestBidder && (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center space-x-2.5 text-xs text-amber-200">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong>You currently hold the lowest valid bid</strong> at ₹{lowestBid?.bidAmount.toLocaleString('en-IN')}. You are currently in winning position and cannot outbid yourself until another member bids lower.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || numericBid <= 0 || !!isCurrentLowestBidder}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {loading
                ? 'Submitting Bid...'
                : isCurrentLowestBidder
                ? 'Currently Lowest Bidder (Cannot Self-Outbid)'
                : 'Place Official Bid'}
            </span>
          </button>
        </form>
      )}
    </div>
  );
}
