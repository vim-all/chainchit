import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cycles, bids, users } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit-logger';
import { sseBroker } from '@/lib/sse-broker';
import { updateTrustScores } from '@/lib/fraud-detector';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'FOREMAN') {
      return NextResponse.json({ error: 'Access denied. Foreman role required.' }, { status: 403 });
    }

    const { id: cycleId } = await params;
    const { action, extraSeconds } = await req.json();

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // 1. Action: Extend timer
    if (action === 'extend_timer') {
      const secondsToAdd = parseInt(extraSeconds) || 60;
      const currentEnd = cycle.biddingEndTime ? new Date(cycle.biddingEndTime).getTime() : Date.now();
      const newEndTime = new Date(Math.max(Date.now(), currentEnd) + secondsToAdd * 1000);
      const newDuration = (cycle.biddingDurationSeconds || 0) + secondsToAdd;

      const [updated] = await db
        .update(cycles)
        .set({
          biddingEndTime: newEndTime,
          biddingDurationSeconds: newDuration,
          status: 'BIDDING_OPEN',
        })
        .where(eq(cycles.id, cycleId))
        .returning();

      await logAuditEvent({
        actorId: user.id,
        actorRole: 'FOREMAN',
        action: 'CYCLE_TIMER_EXTENDED',
        entityType: 'CYCLE',
        entityId: cycleId,
        payload: { extraSeconds: secondsToAdd, newEndTime },
      });

      sseBroker.broadcast(`cycle:${cycleId}`, 'CYCLE_RESET', { cycle: updated });

      return NextResponse.json({ success: true, cycle: updated });
    }

    // 2. Action: Stop Cycle
    if (action === 'stop_cycle') {
      // Find lowest valid bid
      const allCycleBids = await db
        .select()
        .from(bids)
        .where(eq(bids.cycleId, cycleId))
        .orderBy(asc(bids.bidAmount), asc(bids.timestamp));

      const lowestValidBid = allCycleBids.find((b) => b.status === 'ACCEPTED');
      const lowestOverallBid = allCycleBids[0];
      const isLowestBidBlockedByFraud = lowestOverallBid && lowestOverallBid.status === 'FLAGGED_SUSPICIOUS';

      if (!lowestValidBid) {
        const [disputedCycle] = await db
          .update(cycles)
          .set({
            status: 'DISPUTED',
            escrowStatus: 'HELD_FOR_REVIEW',
            biddingEndTime: new Date(),
          })
          .where(eq(cycles.id, cycleId))
          .returning();

        sseBroker.broadcast(`cycle:${cycleId}`, 'CYCLE_DISPUTED', { reason: 'Stopped with no valid bids' });
        return NextResponse.json({ success: true, cycle: disputedCycle });
      }

      await db.update(bids).set({ status: 'WINNING_BID' }).where(eq(bids.id, lowestValidBid.id));

      const [closedCycle] = await db
        .update(cycles)
        .set({
          status: 'BIDDING_CLOSED',
          biddingEndTime: new Date(),
          winningBidId: lowestValidBid.id,
          winnerMemberId: lowestValidBid.memberId,
          payoutAmount: lowestValidBid.bidAmount,
          escrowStatus: isLowestBidBlockedByFraud ? 'HELD_FOR_REVIEW' : 'LOCKED',
        })
        .where(eq(cycles.id, cycleId))
        .returning();

      await updateTrustScores(cycleId);

      await logAuditEvent({
        actorId: user.id,
        actorRole: 'FOREMAN',
        action: 'CYCLE_FORCE_STOPPED',
        entityType: 'CYCLE',
        entityId: cycleId,
        payload: {
          winningBidId: lowestValidBid.id,
          payoutAmount: lowestValidBid.bidAmount,
        },
      });

      const [winnerUser] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, lowestValidBid.memberId))
        .limit(1);

      sseBroker.broadcast(`cycle:${cycleId}`, 'WINNER_DETERMINED', {
        cycleId,
        winner: winnerUser,
        winningBid: lowestValidBid,
      });

      return NextResponse.json({ success: true, cycle: closedCycle, winner: winnerUser });
    }

    return NextResponse.json({ error: 'Invalid action. Use extend_timer or stop_cycle' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
