'use client';

import React from 'react';
import { BidItem } from '../bidding/live-bid-feed';
import { BarChart3, TrendingUp } from 'lucide-react';

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
  // Dynamic domain based on group historical mean and SD
  const safeSd = stdDev > 0 ? stdDev : 2000;
  const safeMean = mean > 0 ? mean : 85000;

  const minVal = safeMean - 4.0 * safeSd;
  const maxVal = safeMean + 2.5 * safeSd;
  const thresholdVal = safeMean - thresholdZ * safeSd;

  const width = 600;
  const height = 180;
  const paddingX = 40;
  const paddingY = 30;
  const plotWidth = width - 2 * paddingX;
  const plotHeight = height - 2 * paddingY;

  function gaussian(x: number) {
    const exponent = -0.5 * Math.pow((x - safeMean) / safeSd, 2);
    return (1 / (safeSd * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
  }

  const peak = gaussian(safeMean);

  function getX(val: number) {
    return paddingX + ((val - minVal) / (maxVal - minVal)) * plotWidth;
  }

  function getY(density: number) {
    return height - paddingY - (density / peak) * plotHeight;
  }

  const points: [number, number][] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const val = minVal + (i / steps) * (maxVal - minVal);
    const dens = gaussian(val);
    points.push([getX(val), getY(dens)]);
  }

  const pathD = points.reduce((acc, [x, y], i) => (i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`), '');
  const meanX = getX(safeMean);

  return (
    <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Statistical Bid Distribution (FR23 & FR24)
            </h3>
            <p className="text-[11px] text-neutral-400">
              Evaluates bids against group empirical parameters (Mean: ₹{Math.round(safeMean).toLocaleString('en-IN')}, σ: ₹{Math.round(safeSd).toLocaleString('en-IN')})
            </p>
          </div>
        </div>

        <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
          <span>Active Bids: {bids.length}</span>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
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
            Empirical Mean (₹{Math.round(safeMean / 1000)}k)
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

      <div className="mt-2 text-[10px] text-neutral-500 flex justify-between px-2 font-mono">
        <span>Lower Bound</span>
        <span>Standard Deviation Range</span>
        <span>Upper Bound</span>
      </div>
    </div>
  );
}
