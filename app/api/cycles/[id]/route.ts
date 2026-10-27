import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cycles, chitGroups, bids, users, fraudAlerts, groupMembers } from '@/lib/db/schema';
import { eq, desc, asc, and } from 'drizzle-orm';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cycleId } = await params;

    // 1. Fetch Cycle
    const [cycle] = await db
      .select()
      .from(cycles)
      .where(eq(cycles.id, cycleId))
      .limit(1);

    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // 2. Fetch Group
    const [group] = await db
      .select()
      .from(chitGroups)
      .where(eq(chitGroups.id, cycle.groupId))
      .limit(1);

    // 3. Fetch Winner (if settled)
    let winner = null;
    if (cycle.winnerMemberId) {
      const [w] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, cycle.winnerMemberId))
        .limit(1);
      winner = w;
    }

    // 4. Fetch Enrolled Members
    const enrolledMembers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        kycStatus: users.kycStatus,
        trustScore: users.trustScore,
        role: users.role,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.memberId, users.id))
      .where(eq(groupMembers.groupId, group.id));

    // 5. Fetch Bids for this cycle with member names
    const cycleBids = await db
      .select({
        id: bids.id,
        memberId: bids.memberId,
        memberName: users.name,
        bidAmount: bids.bidAmount,
        timestamp: bids.timestamp,
        status: bids.status,
        zScore: bids.zScore,
        isAnomaly: bids.isAnomaly,
        fraudReason: bids.fraudReason,
      })
      .from(bids)
      .innerJoin(users, eq(bids.memberId, users.id))
      .where(eq(bids.cycleId, cycleId))
      .orderBy(asc(bids.bidAmount), asc(bids.timestamp));

    // 6. Fetch Active Fraud Alerts
    const alerts = await db
      .select({
        id: fraudAlerts.id,
        bidId: fraudAlerts.bidId,
        memberId: fraudAlerts.memberId,
        memberName: users.name,
        ruleViolated: fraudAlerts.ruleViolated,
        severity: fraudAlerts.severity,
        details: fraudAlerts.details,
        resolved: fraudAlerts.resolved,
        resolutionAction: fraudAlerts.resolutionAction,
        createdAt: fraudAlerts.createdAt,
      })
      .from(fraudAlerts)
      .innerJoin(users, eq(fraudAlerts.memberId, users.id))
      .where(eq(fraudAlerts.cycleId, cycleId))
      .orderBy(desc(fraudAlerts.createdAt));

    // Calculate time remaining in seconds
    let secondsRemaining = 0;
    if (cycle.status === 'BIDDING_OPEN' && cycle.biddingEndTime) {
      const diff = Math.floor((new Date(cycle.biddingEndTime).getTime() - Date.now()) / 1000);
      secondsRemaining = Math.max(0, diff);
    }

    // Find current lowest valid bid
    const lowestValidBid = cycleBids.find((b) => b.status === 'ACCEPTED' || b.status === 'WINNING_BID') || null;

    return NextResponse.json({
      cycle: {
        ...cycle,
        secondsRemaining,
      },
      group,
      winner,
      enrolledMembers,
      bids: cycleBids,
      alerts,
      lowestValidBid,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
