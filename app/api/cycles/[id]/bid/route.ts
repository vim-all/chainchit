import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cycles, chitGroups, bids, users, groupMembers, fraudAlerts } from '@/lib/db/schema';
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
    const { memberId, bidAmount } = await req.json();

    if (!memberId || typeof bidAmount !== 'number' || bidAmount <= 0) {
      return NextResponse.json({ error: 'Valid memberId and bidAmount are required' }, { status: 400 });
    }

    // 1. Fetch Cycle & Chit Group
    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // FR17 / FR20 / FT-14: Bidding Window Check
    if (cycle.status !== 'BIDDING_OPEN') {
      return NextResponse.json(
        { error: 'Bidding window closed', code: 'WINDOW_CLOSED' },
        { status: 400 }
      );
    }

    if (cycle.biddingEndTime && new Date() > new Date(cycle.biddingEndTime)) {
      // Auto-mark as closed if time expired
      await db.update(cycles).set({ status: 'BIDDING_CLOSED' }).where(eq(cycles.id, cycleId));
      return NextResponse.json(
        { error: 'Bidding window closed', code: 'WINDOW_CLOSED' },
        { status: 400 }
      );
    }

    // 2. Fetch Member
    const [member] = await db.select().from(users).where(eq(users.id, memberId)).limit(1);
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // FR18 / FT-12: Eligibility Check (KYC Verification)
    if (member.kycStatus !== 'VERIFIED') {
      return NextResponse.json(
        { error: 'KYC not verified', code: 'KYC_NOT_VERIFIED' },
        { status: 403 }
      );
    }

    // Check enrollment in group
    const [enrolled] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, cycle.groupId), eq(groupMembers.memberId, memberId)))
      .limit(1);

    if (!enrolled) {
      return NextResponse.json(
        { error: 'Member is not enrolled in this chit group', code: 'NOT_ENROLLED' },
        { status: 403 }
      );
    }

    // Validate bid amount does not exceed chit value
    const [group] = await db.select().from(chitGroups).where(eq(chitGroups.id, cycle.groupId)).limit(1);
    if (bidAmount > group.chitValue) {
      return NextResponse.json(
        { error: `Bid amount cannot exceed chit fund pool value (₹${group.chitValue.toLocaleString('en-IN')})` },
        { status: 400 }
      );
    }

    // 3. FR22–FR24: Run In-line Statistical Fraud Detection
    const fraudCheck = await evaluateBidFraud(cycle.groupId, cycleId, memberId, bidAmount);

    const bidStatus = fraudCheck.isAnomaly ? 'FLAGGED_SUSPICIOUS' : 'ACCEPTED';

    // 4. Record Bid in Database
    const [newBid] = await db
      .insert(bids)
      .values({
        cycleId,
        memberId,
        bidAmount,
        status: bidStatus,
        zScore: fraudCheck.zScore,
        isAnomaly: fraudCheck.isAnomaly,
        fraudReason: fraudCheck.details || null,
      })
      .returning();

    let createdAlert = null;

    // 5. If Anomaly: Create Fraud Alert (FR24, FR26)
    if (fraudCheck.isAnomaly && fraudCheck.ruleViolated) {
      const [alert] = await db
        .insert(fraudAlerts)
        .values({
          bidId: newBid.id,
          cycleId,
          memberId,
          ruleViolated: fraudCheck.ruleViolated,
          severity: fraudCheck.severity || 'HIGH',
          details: fraudCheck.details || 'Statistical anomaly detected',
          resolved: false,
        })
        .returning();
      createdAlert = alert;
    }

    // 6. Record in Cryptographic Audit Log (NFR09, NFR13, NFR14)
    await logAuditEvent({
      actorId: member.id,
      actorRole: member.role,
      action: fraudCheck.isAnomaly ? 'BID_FLAGGED_FRAUD' : 'BID_SUBMITTED',
      entityType: 'BID',
      entityId: newBid.id,
      payload: {
        cycleId,
        bidAmount,
        status: bidStatus,
        zScore: fraudCheck.zScore,
        isAnomaly: fraudCheck.isAnomaly,
        fraudReason: fraudCheck.details,
      },
    });

    // 7. Broadcast real-time SSE event to all connected bidders (FR19)
    const bidPayload = {
      id: newBid.id,
      memberId: member.id,
      memberName: member.name,
      bidAmount: newBid.bidAmount,
      timestamp: newBid.timestamp,
      status: newBid.status,
      zScore: newBid.zScore,
      isAnomaly: newBid.isAnomaly,
      fraudReason: newBid.fraudReason,
    };

    sseBroker.broadcast(`cycle:${cycleId}`, 'NEW_BID', {
      bid: bidPayload,
      alert: createdAlert,
    });

    return NextResponse.json({
      success: true,
      bid: bidPayload,
      fraudCheck,
      alert: createdAlert,
    });
  } catch (err: any) {
    console.error('Bid submission error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
