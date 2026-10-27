import { pgTable, text, timestamp, integer, doublePrecision, boolean, uuid, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['MEMBER', 'FOREMAN', 'OVERSIGHT_VIEWER']);
export const cycleStatusEnum = pgEnum('cycle_status', [
  'SCHEDULED',
  'BIDDING_OPEN',
  'BIDDING_CLOSED',
  'SETTLED',
  'DISPUTED'
]);
export const bidStatusEnum = pgEnum('bid_status', [
  'ACCEPTED',
  'FLAGGED_SUSPICIOUS',
  'REJECTED',
  'WINNING_BID'
]);
export const escrowStatusEnum = pgEnum('escrow_status', [
  'LOCKED',
  'RELEASED',
  'HELD_FOR_REVIEW'
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  mobile: text('mobile').notNull(),
  govtId: text('govt_id').notNull(),
  role: roleEnum('role').default('MEMBER').notNull(),
  kycStatus: text('kyc_status').default('VERIFIED').notNull(), // 'PENDING' | 'VERIFIED' | 'REJECTED'
  trustScore: doublePrecision('trust_score').default(100.0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const chitGroups = pgTable('chit_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  chitValue: doublePrecision('chit_value').notNull(), // e.g. 100000
  numberOfMembers: integer('number_of_members').notNull(),
  cycleDurationDays: integer('cycle_duration_days').default(30).notNull(),
  foremanId: uuid('foreman_id').references(() => users.id).notNull(),
  historicalMeanBid: doublePrecision('historical_mean_bid').default(85000.0).notNull(),
  historicalSdBid: doublePrecision('historical_sd_bid').default(4000.0).notNull(),
  fraudThresholdZ: doublePrecision('fraud_threshold_z').default(2.5).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const groupMembers = pgTable('group_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').references(() => chitGroups.id, { onDelete: 'cascade' }).notNull(),
  memberId: uuid('member_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
});

export const cycles = pgTable('cycles', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').references(() => chitGroups.id, { onDelete: 'cascade' }).notNull(),
  cycleNumber: integer('cycle_number').notNull(),
  status: cycleStatusEnum('status').default('SCHEDULED').notNull(),
  biddingStartTime: timestamp('bidding_start_time'),
  biddingEndTime: timestamp('bidding_end_time'),
  biddingDurationSeconds: integer('bidding_duration_seconds').default(120).notNull(),
  winningBidId: uuid('winning_bid_id'),
  winnerMemberId: uuid('winner_member_id').references(() => users.id),
  payoutAmount: doublePrecision('payout_amount'),
  escrowStatus: escrowStatusEnum('escrow_status').default('LOCKED').notNull(),
  settledAt: timestamp('settled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bids = pgTable('bids', {
  id: uuid('id').defaultRandom().primaryKey(),
  cycleId: uuid('cycle_id').references(() => cycles.id, { onDelete: 'cascade' }).notNull(),
  memberId: uuid('member_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  bidAmount: doublePrecision('bid_amount').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  status: bidStatusEnum('status').default('ACCEPTED').notNull(),
  zScore: doublePrecision('z_score').default(0.0).notNull(),
  isAnomaly: boolean('is_anomaly').default(false).notNull(),
  fraudReason: text('fraud_reason'),
});

export const fraudAlerts = pgTable('fraud_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  bidId: uuid('bid_id').references(() => bids.id, { onDelete: 'cascade' }).notNull(),
  cycleId: uuid('cycle_id').references(() => cycles.id, { onDelete: 'cascade' }).notNull(),
  memberId: uuid('member_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  ruleViolated: text('rule_violated').notNull(), // 'UNDERBID_DEVIATION' | 'COLLUSION_WIN_FREQUENCY'
  severity: text('severity').default('HIGH').notNull(),
  details: text('details').notNull(),
  resolved: boolean('resolved').default(false).notNull(),
  resolutionAction: text('resolution_action'), // 'OVERRIDDEN' | 'DISQUALIFIED'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').references(() => users.id),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  payloadJson: text('payload_json').notNull(),
  previousHash: text('previous_hash'),
  entryHash: text('entry_hash').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  bids: many(bids),
  memberships: many(groupMembers),
  fraudAlerts: many(fraudAlerts),
  auditLogs: many(auditLogs),
}));

export const chitGroupsRelations = relations(chitGroups, ({ one, many }) => ({
  foreman: one(users, { fields: [chitGroups.foremanId], references: [users.id] }),
  members: many(groupMembers),
  cycles: many(cycles),
}));

export const cyclesRelations = relations(cycles, ({ one, many }) => ({
  group: one(chitGroups, { fields: [cycles.groupId], references: [chitGroups.id] }),
  winner: one(users, { fields: [cycles.winnerMemberId], references: [users.id] }),
  bids: many(bids),
  fraudAlerts: many(fraudAlerts),
}));

export const bidsRelations = relations(bids, ({ one }) => ({
  cycle: one(cycles, { fields: [bids.cycleId], references: [cycles.id] }),
  member: one(users, { fields: [bids.memberId], references: [users.id] }),
}));

export const fraudAlertsRelations = relations(fraudAlerts, ({ one }) => ({
  bid: one(bids, { fields: [fraudAlerts.bidId], references: [bids.id] }),
  cycle: one(cycles, { fields: [fraudAlerts.cycleId], references: [cycles.id] }),
  member: one(users, { fields: [fraudAlerts.memberId], references: [users.id] }),
}));
