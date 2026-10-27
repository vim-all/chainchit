import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fraudAlerts, bids, cycles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit-logger';
import { sseBroker } from '@/lib/sse-broker';

export async function POST(req: Request) {
  try {
    const { alertId, action, reason, foremanId } = await req.json();

    if (!alertId || !['OVERRIDDEN', 'DISQUALIFIED'].includes(action)) {
      return NextResponse.json({ error: 'Valid alertId and action (OVERRIDDEN or DISQUALIFIED) required' }, { status: 400 });
    }

    const [alert] = await db.select().from(fraudAlerts).where(eq(fraudAlerts.id, alertId)).limit(1);
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // 1. Update Alert status
    await db
      .update(fraudAlerts)
      .set({
        resolved: true,
        resolutionAction: action,
      })
      .where(eq(fraudAlerts.id, alertId));

    // 2. Update Bid status accordingly
    const newBidStatus = action === 'OVERRIDDEN' ? 'ACCEPTED' : 'REJECTED';
    await db
      .update(bids)
      .set({
        status: newBidStatus,
      })
      .where(eq(bids.id, alert.bidId));

    // 3. Log into Audit Log
    await logAuditEvent({
      actorId: foremanId || null,
      actorRole: 'FOREMAN',
      action: `FRAUD_ALERT_${action}`,
      entityType: 'FRAUD_ALERT',
      entityId: alertId,
      payload: {
        alertId,
        bidId: alert.bidId,
        action,
        reason: reason || 'Foreman manual adjudication',
      },
    });

    sseBroker.broadcast(`cycle:${alert.cycleId}`, 'ALERT_RESOLVED', {
      alertId,
      bidId: alert.bidId,
      action,
      newBidStatus,
    });

    return NextResponse.json({ success: true, alertId, action, newBidStatus });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
