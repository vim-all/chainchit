import { db, pool } from './index';
import { users, chitGroups, groupMembers, cycles, bids, fraudAlerts, auditLogs } from './schema';
import { hashPassword } from '../auth';
import crypto from 'crypto';

function computeHash(payload: string, prevHash: string = ''): string {
  return crypto.createHash('sha256').update(prevHash + payload).digest('hex');
}

export async function seedDatabase() {
  console.log('🌱 Initializing ChainChit with Foreman credentials only (Zero Dummy Data)...');

  // Clean existing tables
  await db.delete(auditLogs);
  await db.delete(fraudAlerts);
  await db.delete(bids);
  await db.delete(cycles);
  await db.delete(groupMembers);
  await db.delete(chitGroups);
  await db.delete(users);

  // 1. Create Foreman Account
  const passwordHash = hashPassword('Password@123');

  const [foreman] = await db.insert(users).values({
    name: 'Rajesh (Foreman)',
    email: 'foreman@chainchit.io',
    passwordHash,
    mobile: '9876543210',
    govtId: 'PAN-FRM-001',
    role: 'FOREMAN',
    kycStatus: 'VERIFIED',
    trustScore: 100.0,
  }).returning();

  // 2. Genesis Audit Log
  const prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const genesisPayload = {
    actorId: foreman.id,
    actorRole: 'FOREMAN',
    action: 'SYSTEM_INITIALIZED',
    entityType: 'SYSTEM',
    entityId: foreman.id,
    payloadJson: JSON.stringify({ message: 'ChainChit production ledger initialized' }),
  };

  const entryHash = computeHash(JSON.stringify(genesisPayload), prevHash);

  await db.insert(auditLogs).values({
    ...genesisPayload,
    previousHash: prevHash,
    entryHash,
  });

  console.log('✅ Initialization complete!');
  console.log('==============================================');
  console.log('👑 Foreman Login Credentials:');
  console.log('   Email:    foreman@chainchit.io');
  console.log('   Password: Password@123');
  console.log('==============================================');
  console.log('No dummy members or cycles exist. Members will register dynamically.');

  return { foreman };
}

if (require.main === module) {
  seedDatabase()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
