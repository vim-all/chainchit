import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser, getAllUsers } from '@/lib/auth';

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    const allUsers = await getAllUsers();
    return NextResponse.json({ currentUser, allUsers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    cookieStore.set('chainchit_session', userId, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({ success: true, activeUserId: userId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
