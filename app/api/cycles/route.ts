import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cycles, chitGroups, users } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

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
      })
      .from(cycles)
      .innerJoin(chitGroups, eq(cycles.groupId, chitGroups.id))
      .leftJoin(users, eq(cycles.winnerMemberId, users.id))
      .orderBy(desc(cycles.cycleNumber));

    const activeCycle = allCycles.find((c) => c.status === 'BIDDING_OPEN') || allCycles[0];

    return NextResponse.json({
      cycles: allCycles,
      activeCycleId: activeCycle?.id || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
