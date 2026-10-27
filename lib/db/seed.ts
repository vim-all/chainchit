import { db, pool } from './index';
import { users, chitGroups, groupMembers, cycles, bids, auditLogs } from './schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

function computeHash(payload: string, prevHash: string = ''): string {
  return crypto.createHash('sha256').update(prevHash + payload).digest('hex');
}

export async function seedDatabase() {
  console.log('🌱 Seeding ChainChit database...');

  // Clean existing data
  await db.delete(auditLogs);
  await db.delete(bids);
  await db.delete(cycles);
  await db.delete(groupMembers);
  await db.delete(chitGroups);
  await db.delete(users);

  // 1. Create Users
  const [foreman] = await db.insert(users).values({
    name: 'Rajesh (Foreman)',
    email: 'foreman@chainchit.io',
    mobile: '9876500001',
    govtId: 'PAN-FRM-001',
    role: 'FOREMAN',
    kycStatus: 'VERIFIED',
    trustScore: 100.0,
  }).returning();

  const [raj] = await db.insert(users).values({
    name: 'Raj Kumar',
    email: 'raj@mail.com',
    mobile: '9876543210',
    govtId: 'AADHAAR-8831',
    role: 'MEMBER',
    kycStatus: 'VERIFIED',
    trustScore: 100.0,
  }).returning();

  const [ananya] = await db.insert(users).values({
    name: 'Ananya Sharma',
    email: 'ananya@mail.com',
    mobile: '9876543211',
    govtId: 'AADHAAR-4492',
    role: 'MEMBER',
    kycStatus: 'VERIFIED',
    trustScore: 100.0,
  }).returning();

  const [vikram] = await db.insert(users).values({
    name: 'Vikram Patel',
    email: 'vikram@mail.com',
    mobile: '9876543212',
    govtId: 'AADHAAR-7711',
    role: 'MEMBER',
    kycStatus: 'VERIFIED',
    trustScore: 100.0,
  }).returning();

  const [priya] = await db.insert(users).values({
    name: 'Priya Nair',
    email: 'priya@mail.com',
    mobile: '9876543213',
    govtId: 'AADHAAR-2289',
    role: 'MEMBER',
    kycStatus: 'VERIFIED',
    trustScore: 96.0,
  }).returning();

  const [suresh] = await db.insert(users).values({
    name: 'Suresh Menon',
    email: 'suresh@mail.com',
    mobile: '9876543214',
    govtId: 'AADHAAR-5532',
    role: 'MEMBER',
    kycStatus: 'VERIFIED',
    trustScore: 98.0,
  }).returning();

  const [auditor] = await db.insert(users).values({
    name: 'Auditor Sharma',
    email: 'auditor@chainchit.io',
    mobile: '9876500099',
    govtId: 'OVR-AUD-99',
    role: 'OVERSIGHT_VIEWER',
    kycStatus: 'VERIFIED',
    trustScore: 100.0,
  }).returning();

  // 2. Create Chit Group (Chit Value: ₹1,00,000, 5 members)
  // Baseline statistical parameters from PRD test case FT-15:
  // Historical Mean = ₹85,000, SD = ₹4,000, Threshold Z = 2.5
  const [group] = await db.insert(chitGroups).values({
    name: 'Gold Wealth Chit 2026',
    chitValue: 100000.0,
    numberOfMembers: 5,
    cycleDurationDays: 30,
    foremanId: foreman.id,
    historicalMeanBid: 85000.0,
    historicalSdBid: 4000.0,
    fraudThresholdZ: 2.5,
  }).returning();

  // 3. Enroll Members
  const membersList = [raj, ananya, vikram, priya, suresh];
  for (const m of membersList) {
    await db.insert(groupMembers).values({
      groupId: group.id,
      memberId: m.id,
    });
  }

  // 4. Create Historical Cycle 1 (Settled - Winner: Suresh Menon with ₹84,000)
  const now = new Date();
  const pastStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const pastEnd = new Date(pastStart.getTime() + 180 * 1000);

  const [cycle1] = await db.insert(cycles).values({
    groupId: group.id,
    cycleNumber: 1,
    status: 'SETTLED',
    biddingStartTime: pastStart,
    biddingEndTime: pastEnd,
    biddingDurationSeconds: 180,
    winnerMemberId: suresh.id,
    payoutAmount: 84000.0,
    escrowStatus: 'RELEASED',
    settledAt: pastEnd,
  }).returning();

  // Cycle 1 Bids
  const [b1] = await db.insert(bids).values({
    cycleId: cycle1.id,
    memberId: priya.id,
    bidAmount: 88000.0,
    timestamp: new Date(pastStart.getTime() + 20000),
    status: 'ACCEPTED',
    zScore: -0.75,
    isAnomaly: false,
  }).returning();

  const [b2] = await db.insert(bids).values({
    cycleId: cycle1.id,
    memberId: vikram.id,
    bidAmount: 86000.0,
    timestamp: new Date(pastStart.getTime() + 45000),
    status: 'ACCEPTED',
    zScore: -0.25,
    isAnomaly: false,
  }).returning();

  const [b3] = await db.insert(bids).values({
    cycleId: cycle1.id,
    memberId: raj.id,
    bidAmount: 85000.0,
    timestamp: new Date(pastStart.getTime() + 70000),
    status: 'ACCEPTED',
    zScore: 0.0,
    isAnomaly: false,
  }).returning();

  const [winningBidCycle1] = await db.insert(bids).values({
    cycleId: cycle1.id,
    memberId: suresh.id,
    bidAmount: 84000.0,
    timestamp: new Date(pastStart.getTime() + 110000),
    status: 'WINNING_BID',
    zScore: 0.25,
    isAnomaly: false,
  }).returning();

  await db.update(cycles)
    .set({ winningBidId: winningBidCycle1.id })
    .where(eq(cycles.id, cycle1.id));

  // 5. Create Active Cycle 2 (Ready for live reverse-auction bidding!)
  const cycle2StartTime = new Date();
  const cycle2EndTime = new Date(cycle2StartTime.getTime() + 300 * 1000); // 5 min active window

  const [cycle2] = await db.insert(cycles).values({
    groupId: group.id,
    cycleNumber: 2,
    status: 'BIDDING_OPEN',
    biddingStartTime: cycle2StartTime,
    biddingEndTime: cycle2EndTime,
    biddingDurationSeconds: 300,
    escrowStatus: 'LOCKED',
  }).returning();

  // Initial Seed Bids for Cycle 2 to make the live room immediately active
  await db.insert(bids).values({
    cycleId: cycle2.id,
    memberId: priya.id,
    bidAmount: 89000.0,
    timestamp: new Date(cycle2StartTime.getTime() + 5000),
    status: 'ACCEPTED',
    zScore: -1.0,
    isAnomaly: false,
  });

  await db.insert(bids).values({
    cycleId: cycle2.id,
    memberId: vikram.id,
    bidAmount: 86500.0,
    timestamp: new Date(cycle2StartTime.getTime() + 15000),
    status: 'ACCEPTED',
    zScore: -0.375,
    isAnomaly: false,
  });

  // 6. Genesis Audit Logs
  let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';

  const genesisLog1 = {
    actorId: foreman.id,
    actorRole: 'FOREMAN',
    action: 'GROUP_CREATED',
    entityType: 'CHIT_GROUP',
    entityId: group.id,
    payloadJson: JSON.stringify({ name: group.name, chitValue: group.chitValue }),
  };
  const hash1 = computeHash(JSON.stringify(genesisLog1), prevHash);
  await db.insert(auditLogs).values({
    ...genesisLog1,
    previousHash: prevHash,
    entryHash: hash1,
  });
  prevHash = hash1;

  const genesisLog2 = {
    actorId: foreman.id,
    actorRole: 'FOREMAN',
    action: 'CYCLE_OPENED',
    entityType: 'CYCLE',
    entityId: cycle2.id,
    payloadJson: JSON.stringify({ cycleNumber: 2, durationSeconds: 300 }),
  };
  const hash2 = computeHash(JSON.stringify(genesisLog2), prevHash);
  await db.insert(auditLogs).values({
    ...genesisLog2,
    previousHash: prevHash,
    entryHash: hash2,
  });

  console.log('✅ Seeding complete!');
  console.log(`Users created: Foreman (${foreman.name}), Auditor (${auditor.name}), 5 Members`);
  console.log(`Chit Group created: ${group.name} (₹${group.chitValue.toLocaleString('en-IN')})`);
  console.log(`Active Cycle ID: ${cycle2.id}`);

  return { foreman, auditor, members: membersList, group, activeCycle: cycle2 };
}

// If run directly via tsx / node
if (require.main === module) {
  seedDatabase()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
