import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit-logger';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'FOREMAN') {
      return NextResponse.json({ error: 'Access denied. Foreman role required.' }, { status: 403 });
    }

    const members = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        govtId: users.govtId,
        kycStatus: users.kycStatus,
        trustScore: users.trustScore,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, 'MEMBER'))
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ members });
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

    const { memberId, action, rejectionReason } = await req.json();

    if (!memberId || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ error: 'Valid memberId and action (APPROVE or REJECT) required' }, { status: 400 });
    }

    if (action === 'REJECT' && !rejectionReason?.trim()) {
      return NextResponse.json({ error: 'A rejection reason is mandatory (FR04)' }, { status: 400 });
    }

    const newStatus = action === 'APPROVE' ? 'VERIFIED' : 'REJECTED';

    const [updatedMember] = await db
      .update(users)
      .set({ kycStatus: newStatus })
      .where(eq(users.id, memberId))
      .returning();

    await logAuditEvent({
      actorId: user.id,
      actorRole: 'FOREMAN',
      action: `KYC_${newStatus}`,
      entityType: 'USER',
      entityId: memberId,
      payload: {
        memberId,
        memberName: updatedMember.name,
        action,
        reason: rejectionReason || 'KYC verified successfully',
      },
    });

    return NextResponse.json({ success: true, member: updatedMember });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
