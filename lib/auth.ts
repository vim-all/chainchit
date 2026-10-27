import { cookies } from 'next/headers';
import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'MEMBER' | 'FOREMAN' | 'OVERSIGHT_VIEWER';
  kycStatus: string;
  trustScore: number;
}

const SESSION_COOKIE = 'chainchit_session';

/**
 * Retrieves the currently active user from cookies, or defaults to the first Member if not set
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionUserId) {
    const [user] = await db.select().from(users).where(eq(users.id, sessionUserId)).limit(1);
    if (user) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        kycStatus: user.kycStatus,
        trustScore: user.trustScore,
      };
    }
  }

  // Fallback default: Foreman or first member
  const [defaultUser] = await db.select().from(users).where(eq(users.role, 'FOREMAN')).limit(1);
  if (defaultUser) {
    return {
      id: defaultUser.id,
      name: defaultUser.name,
      email: defaultUser.email,
      role: defaultUser.role,
      kycStatus: defaultUser.kycStatus,
      trustScore: defaultUser.trustScore,
    };
  }

  return null;
}

export async function getAllUsers(): Promise<AuthUser[]> {
  const all = await db.select().from(users).orderBy(users.role, users.name);
  return all.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    kycStatus: u.kycStatus,
    trustScore: u.trustScore,
  }));
}
