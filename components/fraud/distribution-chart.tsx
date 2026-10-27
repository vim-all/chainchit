'use client';

import React from 'react';
import { BidItem } from '../bidding/live-bid-feed';
import { BarChart3, AlertTriangle, ShieldCheck } from 'lucide-react';

interface DistributionChartProps {
  mean: number;
  stdDev: number;
  thresholdZ: number;
  bids: BidItem[];
}

export function DistributionChart({
  mean = 85000,
  stdDev = 4000,
  thresholdZ = 2.5,
  bids = [],
}: DistributionChartProps) {
  // Chart coordinates & domain
  const minVal = mean - 4.5 * stdDev; // e.g. 67,000
  const maxVal = mean + 3.0 * stdDev; // e.g. 97,000
  const thresholdVal = mean - thresholdZ * stdDev; // e.g. 75,000

  // SVG dimensions
  const width = 600;
  const height = 180;
  const paddingX = 40;
  const paddingY = 30;
  const plotWidth = width - 2 * paddingX;
  const plotHeight = height - 2 * paddingY;

  // Gaussian probability density function
  function gaussian(x: number) {
    const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
  }

  const peak = gaussian(mean);

  // Coordinate transforms
  function getX(val: number) {
    return paddingX + ((val - minVal) / (maxVal - minVal)) * plotWidth;
  }

  function getY(density: number) {
    return height - paddingY - (density / peak) * plotHeight;
  }

  // Generate curve path points
  const points: [number, number][] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const val = minVal + (i / steps) * (maxVal - minVal);
    const dens = gaussian(val);
    points.push([getX(val), getY(dens)]);
  }

  const pathD = points.reduce((acc, [x, y], i) => (i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`), '');

  const thresholdX = getX(thresholdVal);
  const meanX = getX(mean);

  return (
    <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Statistical Anomaly Distribution (Bell Curve)
            </h3>
            <p className="text-[11px] text-neutral-400">
              PRD FR23 & FR24: Historical $\mu = ₹{Math.round(mean).toLocaleString('en-IN')}$, $\sigma = ₹{Math.round(stdDev).toLocaleString('en-IN')}$, Threshold = {thresholdZ}σ
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[10px]">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3 h-3" /> Normal Zone (&gt; ₹{Math.round(thresholdVal).toLocaleString('en-IN')})
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <AlertTriangle className="w-3 h-3" /> Anomaly Zone (&lt; ₹{Math.round(thresholdVal).toLocaleString('en-IN')})
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Shaded Red Fraud Zone */}
          <rect
            x={paddingX}
            y={paddingY}
            width={Math.max(0, thresholdX - paddingX)}
            height={plotHeight}
            fill="rgba(244, 63, 94, 0.08)"
            stroke="none"
          />

          {/* Shaded Green Normal Zone */}
          <rect
            x={thresholdX}
            y={paddingY}
            width={width - paddingX - thresholdX}
            height={plotHeight}
            fill="rgba(16, 185, 129, 0.04)"
            stroke="none"
          />

          {/* Baseline horizontal axis */}
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="#374151"
            strokeWidth="1"
          />

          {/* Normal Distribution Curve */}
          <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" />

          {/* Mean (Center) Line */}
          <line
            x1={meanX}
            y1={paddingY}
            x2={meanX}
            y2={height - paddingY}
            stroke="#10b981"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={meanX}
            y={paddingY - 5}
            fill="#10b981"
            fontSize="9"
            fontWeight="bold"
            textAnchor="middle"
          >
            Mean (₹{Math.round(mean / 1000)}k)
          </text>

          {/* Threshold Line (-2.5σ) */}
          <line
            x1={thresholdX}
            y1={paddingY}
            x2={thresholdX}
            y2={height - paddingY}
            stroke="#f43f5e"
            strokeWidth="2"
            strokeDasharray="3 3"
          />
          <text
            x={thresholdX}
            y={paddingY - 5}
            fill="#f43f5e"
            fontSize="9"
            fontWeight="bold"
            textAnchor="middle"
          >
            Cutoff (-{thresholdZ}σ)
          </text>

          {/* Plot Placed Bids as Points */}
          {bids.map((bid) => {
            const bx = getX(Math.max(minVal, Math.min(maxVal, bid.bidAmount)));
            const dens = gaussian(bid.bidAmount);
            const by = getY(dens);
            const isAnomaly = bid.status === 'FLAGGED_SUSPICIOUS';

            return (
              <g key={bid.id} className="transition-all duration-300">
                <circle
                  cx={bx}
                  cy={by}
                  r="5"
                  fill={isAnomaly ? '#f43f5e' : '#38bdf8'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className={isAnomaly ? 'animate-pulse' : ''}
                />
                <text
                  x={bx}
                  y={by - 8}
                  fill={isAnomaly ? '#f43f5e' : '#e2e8f0'}
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ₹{Math.round(bid.bidAmount / 1000)}k
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 text-[10px] text-neutral-500 flex justify-between px-2">
        <span>₹{Math.round(minVal).toLocaleString('en-IN')} (Deep Underbid)</span>
        <span>₹{Math.round(thresholdVal).toLocaleString('en-IN')} (Cutoff Threshold)</span>
        <span>₹{Math.round(mean).toLocaleString('en-IN')} (Normal Average)</span>
        <span>₹{Math.round(maxVal).toLocaleString('en-IN')} (High Claim)</span>
      </div>
    </div>
  );
}
