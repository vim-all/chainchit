import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit-logger';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { name, email, password, mobile, govtId } = await req.json();

    if (!name || !email || !password || !mobile || !govtId) {
      return NextResponse.json({ error: 'All fields (Name, Email, Password, Mobile, Government ID) are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Check duplicate email
    const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email address already exists' }, { status: 400 });
    }

    const passwordHash = hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        mobile: mobile.trim(),
        govtId: govtId.trim(),
        role: 'MEMBER',
        kycStatus: 'PENDING',
        trustScore: 100.0,
      })
      .returning();

    await logAuditEvent({
      actorId: newUser.id,
      actorRole: 'MEMBER',
      action: 'MEMBER_REGISTERED',
      entityType: 'USER',
      entityId: newUser.id,
      payload: { name: newUser.name, email: newUser.email, kycStatus: newUser.kycStatus },
    });

    const cookieStore = await cookies();
    cookieStore.set('chainchit_session', newUser.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        kycStatus: newUser.kycStatus,
        trustScore: newUser.trustScore,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
