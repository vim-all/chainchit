'use client';

import React from 'react';
import { Trophy, AlertOctagon, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';

export interface BidItem {
  id: string;
  memberId: string;
  memberName: string;
  bidAmount: number;
  timestamp: string | Date;
  status: 'ACCEPTED' | 'FLAGGED_SUSPICIOUS' | 'REJECTED' | 'WINNING_BID';
  zScore: number;
  isAnomaly: boolean;
  fraudReason?: string | null;
}

export function LiveBidFeed({ bids }: { bids: BidItem[] }) {
  if (bids.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/80">
        <Clock className="w-8 h-8 text-neutral-600 mx-auto mb-2 animate-bounce" />
        <p className="text-sm font-medium text-neutral-300">No bids submitted yet for this cycle.</p>
        <p className="text-xs text-neutral-500 mt-1">
          Be the first member to place a bid or click "Simulate Bidders" below.
        </p>
      </div>
    );
  }

  // Find lowest valid accepted bid
  const lowestAcceptedBid = bids.find((b) => b.status === 'ACCEPTED' || b.status === 'WINNING_BID');

  return (
    <div className="space-y-3">
      {/* Lowest Bid Highlight Header */}
      {lowestAcceptedBid && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-indigo-950/30 border border-emerald-500/30 shadow-lg shadow-emerald-950/20">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                Current Winning Candidate (Lowest Valid Bid)
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{lowestAcceptedBid.memberName}</span>
                <span className="text-emerald-400 font-mono">
                  ₹{lowestAcceptedBid.bidAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-neutral-400">Discount Dividend</div>
            <div className="text-xs font-semibold text-emerald-300">
              ₹{(100000 - lowestAcceptedBid.bidAmount).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      )}

      {/* List of all bids */}
      <div className="divide-y divide-neutral-800/80 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 overflow-hidden">
        {bids.map((bid, index) => {
          const isWinner = bid.status === 'WINNING_BID';
          const isFlagged = bid.status === 'FLAGGED_SUSPICIOUS';
          const isLowest = lowestAcceptedBid?.id === bid.id;

          return (
            <div
              key={bid.id}
              className={`p-3.5 transition-colors flex items-center justify-between ${
                isFlagged
                  ? 'bg-rose-950/20 hover:bg-rose-950/30'
                  : isWinner
                  ? 'bg-amber-950/20 hover:bg-amber-950/30'
                  : 'hover:bg-neutral-800/30'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs border ${
                    isFlagged
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : isWinner
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                  }`}
                >
                  {isWinner ? (
                    <Trophy className="w-4 h-4 text-amber-400" />
                  ) : isFlagged ? (
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  ) : (
                    <span>#{index + 1}</span>
                  )}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-white">{bid.memberName}</span>
                    {isLowest && !isWinner && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Lowest
                      </span>
                    )}
                    {isWinner && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Winner
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                    <span>{new Date(bid.timestamp).toLocaleTimeString()}</span>
                    {isFlagged && (
                      <span className="text-rose-400 font-semibold flex items-center gap-1">
                        • Z-Score: {bid.zScore} (Anomaly: &gt; 2.5σ)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div
                  className={`font-mono font-bold text-sm ${
                    isFlagged ? 'text-rose-400 line-through' : isWinner ? 'text-amber-400' : 'text-white'
                  }`}
                >
                  ₹{bid.bidAmount.toLocaleString('en-IN')}
                </div>

                <div>
                  {isFlagged ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                      <AlertOctagon className="w-3 h-3" /> Flagged Underbid
                    </span>
                  ) : isWinner ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      <Trophy className="w-3 h-3" /> Awarded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Valid Bid
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
