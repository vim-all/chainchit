import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cycles, users, groupMembers, bids, chitGroups } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { evaluateBidFraud } from '@/lib/fraud-detector';
import { logAuditEvent } from '@/lib/audit-logger';
import { sseBroker } from '@/lib/sse-broker';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cycleId } = await params;
    const { mode } = await req.json();

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    if (mode === 'reset_cycle') {
      // Reset cycle 2 for fresh demo
      const now = new Date();
      const endTime = new Date(now.getTime() + 180 * 1000); // 3 minutes

      // Delete bids and alerts for this cycle
      await db.delete(bids).where(eq(bids.cycleId, cycleId));

      const [updatedCycle] = await db
        .update(cycles)
        .set({
          status: 'BIDDING_OPEN',
          biddingStartTime: now,
          biddingEndTime: endTime,
          biddingDurationSeconds: 180,
          winningBidId: null,
          winnerMemberId: null,
          payoutAmount: null,
          escrowStatus: 'LOCKED',
          settledAt: null,
        })
        .where(eq(cycles.id, cycleId))
        .returning();

      sseBroker.broadcast(`cycle:${cycleId}`, 'CYCLE_RESET', { cycle: updatedCycle });

      return NextResponse.json({ success: true, message: 'Cycle 2 reset for new bidding session', cycle: updatedCycle });
    }

    if (mode === 'fraud_underbid') {
      // Find an enrolled member who hasn't won yet
      const members = await db
        .select({ user: users })
        .from(groupMembers)
        .innerJoin(users, eq(groupMembers.memberId, users.id))
        .where(eq(groupMembers.groupId, cycle.groupId));

      const bidder = members.find((m) => m.user.name.includes('Raj'))?.user || members[0].user;

      // Abnormal underbid: ₹60,000 (Matching PRD test case FT-15)
      const bidAmount = 60000.0;
      const fraudCheck = await evaluateBidFraud(cycle.groupId, cycleId, bidder.id, bidAmount);

      const [newBid] = await db
        .insert(bids)
        .values({
          cycleId,
          memberId: bidder.id,
          bidAmount,
          status: 'FLAGGED_SUSPICIOUS',
          zScore: fraudCheck.zScore,
          isAnomaly: true,
          fraudReason: fraudCheck.details,
        })
        .returning();

      await logAuditEvent({
        actorId: bidder.id,
        actorRole: bidder.role,
        action: 'BID_FLAGGED_FRAUD',
        entityType: 'BID',
        entityId: newBid.id,
        payload: {
          bidAmount,
          zScore: fraudCheck.zScore,
          reason: fraudCheck.details,
        },
      });

      const bidPayload = {
        id: newBid.id,
        memberId: bidder.id,
        memberName: bidder.name,
        bidAmount: newBid.bidAmount,
        timestamp: newBid.timestamp,
        status: newBid.status,
        zScore: newBid.zScore,
        isAnomaly: newBid.isAnomaly,
        fraudReason: newBid.fraudReason,
      };

      sseBroker.broadcast(`cycle:${cycleId}`, 'NEW_BID', {
        bid: bidPayload,
        isAlert: true,
      });

      return NextResponse.json({
        success: true,
        bid: bidPayload,
        fraudCheck,
      });
    }

    if (mode === 'concurrent_bids') {
      // Simulate 3 competitors bidding in reverse auction:
      // Ananya (₹81,000), Vikram (₹78,000), Priya (₹76,500)
      const allMembers = await db
        .select({ user: users })
        .from(groupMembers)
        .innerJoin(users, eq(groupMembers.memberId, users.id))
        .where(eq(groupMembers.groupId, cycle.groupId));

      const eligibleMembers = allMembers
        .map((m) => m.user)
        .filter((u) => u.name !== 'Suresh Menon'); // Suresh already won cycle 1

      const simulatedBids = [
        { member: eligibleMembers[1] || eligibleMembers[0], amount: 81000 },
        { member: eligibleMembers[2] || eligibleMembers[0], amount: 78500 },
        { member: eligibleMembers[0], amount: 77000 },
      ];

      const inserted = [];
      for (const item of simulatedBids) {
        const fraudCheck = await evaluateBidFraud(cycle.groupId, cycleId, item.member.id, item.amount);
        const [bidRecord] = await db
          .insert(bids)
          .values({
            cycleId,
            memberId: item.member.id,
            bidAmount: item.amount,
            status: fraudCheck.isAnomaly ? 'FLAGGED_SUSPICIOUS' : 'ACCEPTED',
            zScore: fraudCheck.zScore,
            isAnomaly: fraudCheck.isAnomaly,
            fraudReason: fraudCheck.details,
          })
          .returning();

        const bidPayload = {
          id: bidRecord.id,
          memberId: item.member.id,
          memberName: item.member.name,
          bidAmount: bidRecord.bidAmount,
          timestamp: bidRecord.timestamp,
          status: bidRecord.status,
          zScore: bidRecord.zScore,
          isAnomaly: bidRecord.isAnomaly,
          fraudReason: bidRecord.fraudReason,
        };

        sseBroker.broadcast(`cycle:${cycleId}`, 'NEW_BID', { bid: bidPayload });
        inserted.push(bidPayload);
      }

      return NextResponse.json({
        success: true,
        bids: inserted,
      });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (err: any) {
    console.error('Simulation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
