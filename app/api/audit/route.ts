import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLogs, users } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { verifyAuditChainIntegrity } from '@/lib/audit-logger';

export async function GET() {
  try {
    const logs = await db
      .select({
        id: auditLogs.id,
        actorId: auditLogs.actorId,
        actorName: users.name,
        actorRole: auditLogs.actorRole,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        payloadJson: auditLogs.payloadJson,
        previousHash: auditLogs.previousHash,
        entryHash: auditLogs.entryHash,
        timestamp: auditLogs.timestamp,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .orderBy(desc(auditLogs.timestamp))
      .limit(100);

    const integrity = await verifyAuditChainIntegrity();

    return NextResponse.json({
      logs,
      integrity,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
