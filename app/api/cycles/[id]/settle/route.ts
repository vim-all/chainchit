import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cycles, bids, users, fraudAlerts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit-logger';
import { sseBroker } from '@/lib/sse-broker';
import crypto from 'crypto';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cycleId } = await params;
    const body = await req.json().catch(() => ({}));
    const actorId = body.actorId;

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // FR30 / FT-18: Prevent duplicate payout for same cycle
    if (cycle.status === 'SETTLED' || cycle.escrowStatus === 'RELEASED') {
      return NextResponse.json(
        { error: 'Cycle already settled', code: 'ALREADY_SETTLED' },
        { status: 400 }
      );
    }

    if (!cycle.winningBidId || !cycle.winnerMemberId) {
      return NextResponse.json(
        { error: 'Cannot settle cycle before a valid winner has been determined', code: 'NO_WINNER' },
        { status: 400 }
      );
    }

    // FR27 / FT-17: Conditional Payout Release:
    // Check if winning bid or cycle has unresolved high-severity fraud alerts
    const [winningBid] = await db
      .select()
      .from(bids)
      .where(eq(bids.id, cycle.winningBidId))
      .limit(1);

    if (winningBid.status === 'FLAGGED_SUSPICIOUS') {
      return NextResponse.json(
        {
          error: 'Payout blocked: Winning bid is flagged as suspicious. Requires foreman review and clearance.',
          code: 'PAYOUT_BLOCKED_FRAUD',
        },
        { status: 403 }
      );
    }

    const unresolvedAlerts = await db
      .select()
      .from(fraudAlerts)
      .where(and(eq(fraudAlerts.cycleId, cycleId), eq(fraudAlerts.bidId, cycle.winningBidId), eq(fraudAlerts.resolved, false)));

    if (unresolvedAlerts.length > 0) {
      return NextResponse.json(
        {
          error: 'Payout blocked: Unresolved fraud alerts exist on the winning bid.',
          code: 'PAYOUT_BLOCKED_UNRESOLVED_ALERT',
        },
        { status: 403 }
      );
    }

    // Generate settlement receipt (FR28)
    const receiptId = `RCP-${cycle.cycleNumber}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Mark as settled and release escrow
    const [settledCycle] = await db
      .update(cycles)
      .set({
        status: 'SETTLED',
        escrowStatus: 'RELEASED',
        settledAt: new Date(),
      })
      .where(eq(cycles.id, cycleId))
      .returning();

    // Audit log (NFR09, NFR13, NFR14)
    await logAuditEvent({
      actorId: actorId || null,
      actorRole: 'FOREMAN',
      action: 'PAYOUT_RELEASED',
      entityType: 'PAYOUT',
      entityId: receiptId,
      payload: {
        cycleId,
        winnerMemberId: cycle.winnerMemberId,
        payoutAmount: cycle.payoutAmount,
        receiptId,
      },
    });

    const settlementPayload = {
      cycleId,
      winnerMemberId: cycle.winnerMemberId,
      payoutAmount: cycle.payoutAmount,
      receiptId,
      settledAt: settledCycle.settledAt,
    };

    sseBroker.broadcast(`cycle:${cycleId}`, 'CYCLE_SETTLED', settlementPayload);

    return NextResponse.json({
      success: true,
      receiptId,
      cycle: settledCycle,
    });
  } catch (err: any) {
    console.error('Settlement error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
