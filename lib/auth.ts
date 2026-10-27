import { cookies } from 'next/headers';
import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'MEMBER' | 'FOREMAN' | 'OVERSIGHT_VIEWER';
  kycStatus: string;
  trustScore: number;
}

const SESSION_COOKIE = 'chainchit_session';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, combined: string): boolean {
  try {
    const [salt, key] = combined.split(':');
    if (!salt || !key) return false;
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Retrieves the currently authenticated user from secure session cookie
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionUserId) {
    return null;
  }

  const [user] = await db.select().from(users).where(eq(users.id, sessionUserId)).limit(1);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    kycStatus: user.kycStatus,
    trustScore: user.trustScore,
  };
}
