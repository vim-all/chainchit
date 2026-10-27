import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

function generateEntryHash(previousHash: string, payloadString: string): string {
  return crypto.createHash('sha256').update(previousHash + payloadString).digest('hex');
}

describe('Statistical Bid-Fraud Detection Mathematical Engine', () => {
  const mean = 85000;
  const stdDev = 4000;
  const thresholdZ = 2.5;

  function calculateZScore(bid: number) {
    return parseFloat(((mean - bid) / stdDev).toFixed(2));
  }

  function evaluateBid(bid: number) {
    const zScore = calculateZScore(bid);
    const isAnomaly = zScore > thresholdZ;
    return { zScore, isAnomaly };
  }

  it('FT-13: Normal competitive bid within window is accepted', () => {
    const bidAmount = 82000;
    const { zScore, isAnomaly } = evaluateBid(bidAmount);
    assert.strictEqual(zScore, 0.75);
    assert.strictEqual(isAnomaly, false);
  });

  it('FT-15: Abnormal deep underbid (₹60,000) is flagged as suspicious', () => {
    const bidAmount = 60000;
    const { zScore, isAnomaly } = evaluateBid(bidAmount);
    // (85000 - 60000) / 4000 = 6.25 standard deviations below mean
    assert.strictEqual(zScore, 6.25);
    assert.strictEqual(isAnomaly, true);
    assert.ok(zScore > thresholdZ, 'Z-score must exceed 2.5 threshold');
  });

  it('FT-16: Winner selection correctly identifies lowest VALID bid', () => {
    const bids = [
      { id: 'b1', member: 'Raj', amount: 82000, status: 'ACCEPTED' },
      { id: 'b2', member: 'Ananya', amount: 78000, status: 'ACCEPTED' },
      { id: 'b3', member: 'Vikram', amount: 80000, status: 'ACCEPTED' },
      { id: 'b4', member: 'BadActor', amount: 60000, status: 'FLAGGED_SUSPICIOUS' },
    ];

    // System filters out FLAGGED_SUSPICIOUS bids and selects lowest valid
    const validBids = bids.filter((b) => b.status === 'ACCEPTED');
    validBids.sort((a, b) => a.amount - b.amount);

    const winner = validBids[0];
    assert.strictEqual(winner.member, 'Ananya');
    assert.strictEqual(winner.amount, 78000);
    assert.notStrictEqual(winner.amount, 60000, 'Flagged underbid must NOT win');
  });
});

describe('Tamper-Evident SHA-256 Audit Log Hash Chaining (NFR13)', () => {
  it('detects tampering when payload or previous hash is modified', () => {
    const prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const originalPayload = JSON.stringify({ action: 'BID_SUBMITTED', bid: 82000 });
    const correctHash = generateEntryHash(prevHash, originalPayload);

    // Verify correct calculation
    assert.ok(correctHash.length === 64);

    // Simulate tampering with bid amount
    const tamperedPayload = JSON.stringify({ action: 'BID_SUBMITTED', bid: 75000 });
    const tamperedHash = generateEntryHash(prevHash, tamperedPayload);

    assert.notStrictEqual(correctHash, tamperedHash, 'Tampered data must yield distinct SHA-256 digest');
  });
});
