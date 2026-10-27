import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cycles, chitGroups, groupMembers } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit-logger';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'FOREMAN') {
      return NextResponse.json({ error: 'Access denied. Foreman role required.' }, { status: 403 });
    }

    const { groupId, durationSeconds = 180 } = await req.json();

    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
    }

    const [group] = await db.select().from(chitGroups).where(eq(chitGroups.id, groupId)).limit(1);
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Check minimum enrollment (FR10)
    const enrolled = await db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
    if (enrolled.length === 0) {
      return NextResponse.json({ error: 'Cannot start cycle: No members enrolled in this group yet.' }, { status: 400 });
    }

    // Determine next cycle number
    const pastCycles = await db
      .select({ cycleNumber: cycles.cycleNumber })
      .from(cycles)
      .where(eq(cycles.groupId, groupId))
      .orderBy(desc(cycles.cycleNumber))
      .limit(1);

    const nextCycleNumber = (pastCycles[0]?.cycleNumber || 0) + 1;

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

    const [newCycle] = await db
      .insert(cycles)
      .values({
        groupId,
        cycleNumber: nextCycleNumber,
        status: 'BIDDING_OPEN',
        biddingStartTime: startTime,
        biddingEndTime: endTime,
        biddingDurationSeconds: durationSeconds,
        escrowStatus: 'LOCKED',
      })
      .returning();

    await logAuditEvent({
      actorId: user.id,
      actorRole: 'FOREMAN',
      action: 'CYCLE_OPENED',
      entityType: 'CYCLE',
      entityId: newCycle.id,
      payload: {
        groupId,
        cycleNumber: nextCycleNumber,
        durationSeconds,
      },
    });

    return NextResponse.json({ success: true, cycle: newCycle });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
