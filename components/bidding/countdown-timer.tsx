'use client';

import React, { useEffect, useState } from 'react';
import { Timer, AlertTriangle } from 'lucide-react';

interface CountdownTimerProps {
  endTime: string | null;
  durationSeconds: number;
  status: string;
  onExpire?: () => void;
}

export function CountdownTimer({
  endTime,
  durationSeconds,
  status,
  onExpire,
}: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [hasExpired, setHasExpired] = useState(false);

  useEffect(() => {
    if (!endTime || status !== 'BIDDING_OPEN') {
      setSecondsLeft(0);
      return;
    }

    const calculateRemaining = () => {
      const target = new Date(endTime).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((target - now) / 1000));
      setSecondsLeft(diff);

      if (diff === 0 && !hasExpired) {
        setHasExpired(true);
        onExpire?.();
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);

    return () => clearInterval(interval);
  }, [endTime, status, hasExpired, onExpire]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progress = durationSeconds > 0 ? (secondsLeft / durationSeconds) * 100 : 0;
  const isUrgent = secondsLeft > 0 && secondsLeft <= 30;

  if (status !== 'BIDDING_OPEN') {
    return (
      <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400">
        <Timer className="w-4 h-4 text-neutral-500" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          {status === 'SETTLED' ? 'Cycle Settled' : status === 'DISPUTED' ? 'Held in Dispute' : 'Bidding Closed'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center space-x-3 px-4 py-2 rounded-2xl border transition-all ${
        isUrgent
          ? 'bg-rose-950/30 border-rose-500/50 text-rose-300 animate-pulse shadow-lg shadow-rose-900/20'
          : 'bg-neutral-900 border-neutral-800 text-neutral-200'
      }`}
    >
      <div className="relative flex items-center justify-center">
        {/* Simple SVG Circular Indicator */}
        <svg className="w-9 h-9 transform -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="14"
            className="stroke-neutral-800"
            strokeWidth="3"
            fill="transparent"
          />
          <circle
            cx="18"
            cy="18"
            r="14"
            className={`transition-all duration-1000 ${
              isUrgent ? 'stroke-rose-500' : 'stroke-indigo-500'
            }`}
            strokeWidth="3"
            strokeDasharray={2 * Math.PI * 14}
            strokeDashoffset={2 * Math.PI * 14 * (1 - progress / 100)}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute">
          {isUrgent ? (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <Timer className="w-3.5 h-3.5 text-indigo-400" />
          )}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
          {isUrgent ? 'Closing Soon' : 'Window Closes In'}
        </div>
        <div className="font-mono text-base font-bold tracking-tight">
          {formattedTime}
        </div>
      </div>
    </div>
  );
}
