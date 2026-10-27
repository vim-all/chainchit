import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chitGroups, groupMembers, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit-logger';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groups = await db.select().from(chitGroups).orderBy(desc(chitGroups.createdAt));
    return NextResponse.json({ groups });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'FOREMAN') {
      return NextResponse.json({ error: 'Access denied. Foreman role required.' }, { status: 403 });
    }

    const { name, chitValue, numberOfMembers, cycleDurationDays, memberIds, fraudThresholdZ } = await req.json();

    if (!name || !chitValue || !numberOfMembers) {
      return NextResponse.json({ error: 'Name, Chit Value, and Number of Members are required' }, { status: 400 });
    }

    // Default baseline mean = 85% of chitValue, SD = 4% of chitValue
    const numericChitValue = parseFloat(chitValue);
    const baselineMean = numericChitValue * 0.85;
    const baselineSd = numericChitValue * 0.04;

    const [newGroup] = await db
      .insert(chitGroups)
      .values({
        name: name.trim(),
        chitValue: numericChitValue,
        numberOfMembers: parseInt(numberOfMembers),
        cycleDurationDays: cycleDurationDays ? parseInt(cycleDurationDays) : 30,
        foremanId: user.id,
        historicalMeanBid: baselineMean,
        historicalSdBid: baselineSd,
        fraudThresholdZ: fraudThresholdZ ? parseFloat(fraudThresholdZ) : 2.5,
      })
      .returning();

    // Enroll members if provided
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      for (const mId of memberIds) {
        await db.insert(groupMembers).values({
          groupId: newGroup.id,
          memberId: mId,
        });
      }
    }

    await logAuditEvent({
      actorId: user.id,
      actorRole: 'FOREMAN',
      action: 'GROUP_CREATED',
      entityType: 'CHIT_GROUP',
      entityId: newGroup.id,
      payload: {
        name: newGroup.name,
        chitValue: newGroup.chitValue,
        numberOfMembers: newGroup.numberOfMembers,
        enrolledCount: memberIds?.length || 0,
      },
    });

    return NextResponse.json({ success: true, group: newGroup });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
