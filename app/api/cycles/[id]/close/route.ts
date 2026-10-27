import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cycles, bids, users, chitGroups, fraudAlerts } from '@/lib/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit-logger';
import { sseBroker } from '@/lib/sse-broker';
import { updateTrustScores } from '@/lib/fraud-detector';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cycleId } = await params;

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    if (cycle.status === 'SETTLED') {
      return NextResponse.json({ error: 'Cycle is already settled', code: 'ALREADY_SETTLED' }, { status: 400 });
    }

    // 1. Fetch all bids for this cycle ordered by lowest bid amount (reverse auction)
    const allCycleBids = await db
      .select()
      .from(bids)
      .where(eq(bids.cycleId, cycleId))
      .orderBy(asc(bids.bidAmount), asc(bids.timestamp));

    if (allCycleBids.length === 0) {
      await db.update(cycles).set({ status: 'BIDDING_CLOSED' }).where(eq(cycles.id, cycleId));
      return NextResponse.json({
        success: true,
        message: 'Bidding closed with 0 bids placed.',
        winner: null,
      });
    }

    // 2. FR21 / FT-16 / FT-17: Determine winner as lowest VALID, non-flagged bid
    const lowestValidBid = allCycleBids.find((b) => b.status === 'ACCEPTED');
    const lowestOverallBid = allCycleBids[0];

    // Check if the absolute lowest bid was blocked by fraud detection
    const isLowestBidBlockedByFraud = lowestOverallBid && lowestOverallBid.status === 'FLAGGED_SUSPICIOUS';

    if (!lowestValidBid) {
      // All submitted bids were flagged as anomalies!
      await db
        .update(cycles)
        .set({
          status: 'DISPUTED',
          escrowStatus: 'HELD_FOR_REVIEW',
        })
        .where(eq(cycles.id, cycleId));

      await logAuditEvent({
        actorRole: 'SYSTEM',
        action: 'CYCLE_DISPUTED_ALL_BIDS_FLAGGED',
        entityType: 'CYCLE',
        entityId: cycleId,
        payload: { cycleId, totalBids: allCycleBids.length },
      });

      sseBroker.broadcast(`cycle:${cycleId}`, 'CYCLE_DISPUTED', {
        reason: 'All received bids triggered fraud flags. Payout held for foreman investigation.',
      });

      return NextResponse.json({
        success: false,
        status: 'DISPUTED',
        message: 'All submitted bids triggered fraud flags. Payout held for investigation.',
      });
    }

    // 3. Mark the winning bid
    await db.update(bids).set({ status: 'WINNING_BID' }).where(eq(bids.id, lowestValidBid.id));

    // 4. Update cycle with winner and closed status
    const [updatedCycle] = await db
      .update(cycles)
      .set({
        status: 'BIDDING_CLOSED',
        winningBidId: lowestValidBid.id,
        winnerMemberId: lowestValidBid.memberId,
        payoutAmount: lowestValidBid.bidAmount,
        escrowStatus: isLowestBidBlockedByFraud ? 'HELD_FOR_REVIEW' : 'LOCKED',
      })
      .where(eq(cycles.id, cycleId))
      .returning();

    // 5. Fetch winning member details
    const [winnerUser] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, lowestValidBid.memberId))
      .limit(1);

    // 6. Recalculate trust scores (FR25)
    await updateTrustScores(cycleId);

    // 7. Audit log (NFR09, NFR14)
    await logAuditEvent({
      actorRole: 'SYSTEM',
      action: 'WINNER_DETERMINED',
      entityType: 'CYCLE',
      entityId: cycleId,
      payload: {
        winningBidId: lowestValidBid.id,
        winnerMemberId: lowestValidBid.memberId,
        winnerName: winnerUser.name,
        winningAmount: lowestValidBid.bidAmount,
        lowestBidWasFlagged: isLowestBidBlockedByFraud,
      },
    });

    const winnerPayload = {
      cycleId,
      winner: winnerUser,
      winningBid: lowestValidBid,
      isLowestBidBlockedByFraud,
      payoutAmount: lowestValidBid.bidAmount,
    };

    // 8. Broadcast SSE event
    sseBroker.broadcast(`cycle:${cycleId}`, 'WINNER_DETERMINED', winnerPayload);

    return NextResponse.json({
      success: true,
      cycle: updatedCycle,
      ...winnerPayload,
    });
  } catch (err: any) {
    console.error('Cycle close error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
