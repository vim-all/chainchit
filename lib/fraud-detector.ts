import { db } from './db';
import { bids, cycles, users, chitGroups, fraudAlerts } from './db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export interface FraudCheckResult {
  isAnomaly: boolean;
  zScore: number;
  mean: number;
  stdDev: number;
  ruleViolated?: 'UNDERBID_DEVIATION' | 'COLLUSION_WIN_FREQUENCY' | 'ALREADY_WON';
  severity?: 'HIGH' | 'MEDIUM';
  details?: string;
}

/**
 * Evaluates a bid against statistical thresholds and collusion rules
 * Requirements: FR22, FR23, FR24, FR25
 */
export async function evaluateBidFraud(
  groupId: string,
  cycleId: string,
  memberId: string,
  bidAmount: number
): Promise<FraudCheckResult> {
  // 1. Fetch group configuration & baseline stats
  const [group] = await db.select().from(chitGroups).where(eq(chitGroups.id, groupId)).limit(1);
  if (!group) {
    throw new Error(`Group ${groupId} not found`);
  }

  // 2. Fetch member & past cycle stats
  const [member] = await db.select().from(users).where(eq(users.id, memberId)).limit(1);
  if (!member) {
    throw new Error(`Member ${memberId} not found`);
  }

  // Rule A (FR22 / Collusion & Chit Fund Rules): Member cannot win multiple times in the same chit group term
  const pastWins = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.groupId, groupId), eq(cycles.winnerMemberId, memberId), eq(cycles.status, 'SETTLED')));

  if (pastWins.length > 0) {
    return {
      isAnomaly: true,
      zScore: 0,
      mean: group.historicalMeanBid,
      stdDev: group.historicalSdBid,
      ruleViolated: 'ALREADY_WON',
      severity: 'HIGH',
      details: `Member ${member.name} has already won Cycle #${pastWins[0].cycleNumber} in this group. Multiple prize collections violate chit fund equity.`,
    };
  }

  // 3. Statistical Underbid Deviation Check (FR23, FR24)
  // Fetch historical bids from completed or earlier cycles in this group
  const historicalBids = await db
    .select({ bidAmount: bids.bidAmount })
    .from(bids)
    .innerJoin(cycles, eq(bids.cycleId, cycles.id))
    .where(
      and(
        eq(cycles.groupId, groupId),
        eq(bids.status, 'ACCEPTED')
      )
    );

  let mean = group.historicalMeanBid;
  let stdDev = group.historicalSdBid;

  // If we have at least 4 historical clean bids, calculate dynamic mean & SD
  if (historicalBids.length >= 4) {
    const amounts = historicalBids.map((b) => b.bidAmount);
    const sum = amounts.reduce((acc, val) => acc + val, 0);
    mean = sum / amounts.length;
    const variance = amounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / amounts.length;
    stdDev = Math.sqrt(variance) || group.historicalSdBid;
  }

  // Z-Score for reverse auction:
  // How many standard deviations below the mean is this bid?
  // Z = (mean - bidAmount) / stdDev
  // Positive Z means the bid is lower than average (higher discount).
  const zScore = parseFloat(((mean - bidAmount) / (stdDev > 0 ? stdDev : 1)).toFixed(2));
  const threshold = group.fraudThresholdZ || 2.5;

  if (zScore > threshold) {
    return {
      isAnomaly: true,
      zScore,
      mean,
      stdDev,
      ruleViolated: 'UNDERBID_DEVIATION',
      severity: 'HIGH',
      details: `Abnormal underbid detected: Bid of ₹${bidAmount.toLocaleString('en-IN')} is ${zScore} standard deviations below historical mean (₹${Math.round(mean).toLocaleString('en-IN')}, σ=₹${Math.round(stdDev).toLocaleString('en-IN')}). Threshold is ${threshold}σ.`,
    };
  }

  return {
    isAnomaly: false,
    zScore,
    mean,
    stdDev,
  };
}

/**
 * Recalculate member & foreman trust scores at the end of a cycle
 * Requirement: FR25
 */
export async function updateTrustScores(cycleId: string) {
  const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
  if (!cycle) return;

  const cycleBids = await db.select().from(bids).where(eq(bids.cycleId, cycleId));

  for (const b of cycleBids) {
    if (b.status === 'ACCEPTED' || b.status === 'WINNING_BID') {
      // Clean participant bonus: +5 points up to 100
      await db
        .update(users)
        .set({
          trustScore: sql`LEAST(100.0, ${users.trustScore} + 5.0)`,
        })
        .where(eq(users.id, b.memberId));
    } else if (b.status === 'FLAGGED_SUSPICIOUS') {
      // Sustained anomaly penalty: -25 points
      await db
        .update(users)
        .set({
          trustScore: sql`GREATEST(0.0, ${users.trustScore} - 25.0)`,
        })
        .where(eq(users.id, b.memberId));
    }
  }
}
