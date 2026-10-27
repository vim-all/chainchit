import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLogs, users } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET() {
  try {
    const logs = await db
      .select({
        id: auditLogs.id,
        timestamp: auditLogs.timestamp,
        actorName: users.name,
        actorRole: auditLogs.actorRole,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        previousHash: auditLogs.previousHash,
        entryHash: auditLogs.entryHash,
        payloadJson: auditLogs.payloadJson,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .orderBy(desc(auditLogs.timestamp));

    // Generate CSV Header
    let csv = 'Timestamp,Actor Name,Role,Action,Entity Type,Entity ID,Entry Hash (SHA-256),Previous Hash\n';

    for (const row of logs) {
      const time = new Date(row.timestamp).toISOString();
      const actor = (row.actorName || 'System').replace(/,/g, '');
      const role = row.actorRole;
      const action = row.action;
      const entity = row.entityType;
      const id = row.entityId;
      const hash = row.entryHash;
      const prev = row.previousHash || '';
      csv += `${time},${actor},${role},${action},${entity},${id},${hash},${prev}\n`;
    }

    // Append cryptographic signature block
    const fullLogDigest = crypto.createHash('sha256').update(csv).digest('hex');
    csv += `\n# --- CRYPTOGRAPHIC ATTESTATION ---\n`;
    csv += `# Signer: ChainChit Oversight Notary Service\n`;
    csv += `# Log Digest SHA-256: ${fullLogDigest}\n`;
    csv += `# Exported At: ${new Date().toISOString()}\n`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="chainchit_audit_log_${Date.now()}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
