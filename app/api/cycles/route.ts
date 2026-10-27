import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cycles, chitGroups, users, bids } from '@/lib/db/schema';
import { desc, eq, asc } from 'drizzle-orm';

export async function GET() {
  try {
    const allCycles = await db
      .select({
        id: cycles.id,
        cycleNumber: cycles.cycleNumber,
        status: cycles.status,
        biddingStartTime: cycles.biddingStartTime,
        biddingEndTime: cycles.biddingEndTime,
        biddingDurationSeconds: cycles.biddingDurationSeconds,
        payoutAmount: cycles.payoutAmount,
        escrowStatus: cycles.escrowStatus,
        winnerMemberId: cycles.winnerMemberId,
        winnerName: users.name,
        groupName: chitGroups.name,
        chitValue: chitGroups.chitValue,
        groupId: chitGroups.id,
        createdAt: cycles.createdAt,
      })
      .from(cycles)
      .innerJoin(chitGroups, eq(cycles.groupId, chitGroups.id))
      .leftJoin(users, eq(cycles.winnerMemberId, users.id))
      .orderBy(desc(cycles.createdAt));

    const activeCycles = allCycles.filter((c) => c.status === 'BIDDING_OPEN');
    const activeCycleId = activeCycles[0]?.id || allCycles[0]?.id || null;

    return NextResponse.json({
      cycles: allCycles,
      activeCycles,
      activeCycleId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
