import { db } from './db';
import { auditLogs } from './db/schema';
import { desc, eq } from 'drizzle-orm';
import crypto from 'crypto';

export interface AuditActionParams {
  actorId?: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, any>;
}

export function generateEntryHash(previousHash: string, payloadString: string): string {
  return crypto.createHash('sha256').update(previousHash + payloadString).digest('hex');
}

/**
 * Appends a tamper-evident, SHA-256 hash-chained entry to the audit log
 */
export async function logAuditEvent(params: AuditActionParams) {
  // 1. Get the most recent log to obtain previousHash
  const latestLogs = await db
    .select({ entryHash: auditLogs.entryHash })
    .from(auditLogs)
    .orderBy(desc(auditLogs.timestamp))
    .limit(1);

  const previousHash =
    latestLogs.length > 0
      ? latestLogs[0].entryHash
      : '0000000000000000000000000000000000000000000000000000000000000000';

  const payloadJson = JSON.stringify(params.payload);
  const dataToHash = JSON.stringify({
    actorId: params.actorId || null,
    actorRole: params.actorRole,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    payloadJson,
  });

  const entryHash = generateEntryHash(previousHash, dataToHash);

  const [newLog] = await db
    .insert(auditLogs)
    .values({
      actorId: params.actorId || null,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      payloadJson,
      previousHash,
      entryHash,
    })
    .returning();

  return newLog;
}

/**
 * Validates the cryptographic integrity of the entire audit chain
 * Verifies NFR13 (Tamper Detection)
 */
export async function verifyAuditChainIntegrity(): Promise<{
  valid: boolean;
  totalEntries: number;
  corruptedEntryId?: string;
  message: string;
}> {
  const allLogs = await db.select().from(auditLogs).orderBy(auditLogs.timestamp);

  let expectedPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';

  for (let i = 0; i < allLogs.length; i++) {
    const log = allLogs[i];

    if (log.previousHash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: allLogs.length,
        corruptedEntryId: log.id,
        message: `Broken chain detected at entry ${log.id}! Expected previous hash: ${expectedPrevHash.slice(0, 8)}..., but found: ${log.previousHash?.slice(0, 8)}...`,
      };
    }

    const dataToHash = JSON.stringify({
      actorId: log.actorId,
      actorRole: log.actorRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      payloadJson: log.payloadJson,
    });

    const recalculatedHash = generateEntryHash(expectedPrevHash, dataToHash);

    // If entry was modified
    if (log.entryHash !== recalculatedHash) {
      return {
        valid: false,
        totalEntries: allLogs.length,
        corruptedEntryId: log.id,
        message: `Tampering detected at log ${log.id}! Recomputed hash ${recalculatedHash.slice(0, 8)}... does not match stored hash ${log.entryHash.slice(0, 8)}...`,
      };
    }

    expectedPrevHash = log.entryHash;
  }

  return {
    valid: true,
    totalEntries: allLogs.length,
    message: `All ${allLogs.length} audit entries cryptographically verified against SHA-256 chain.`,
  };
}
