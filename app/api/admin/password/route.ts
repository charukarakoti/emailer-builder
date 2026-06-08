import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, getCurrentSession } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userId, password } = body as { userId?: string; password?: string };

  if (!userId || !password || typeof password !== "string") {
    return NextResponse.json({ error: "Missing userId or password" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  if (!session.activeTeamId) {
    return NextResponse.json({ error: "No active team" }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      teamId: session.activeTeamId,
      role: "OWNER",
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const hashedPassword = await hashPassword(password);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashedPassword },
  });

  return NextResponse.json({ success: true });
}
