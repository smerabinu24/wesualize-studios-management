import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";

const MIN_PASSWORD = 8;

export async function POST(req: Request) {
  const { userId, token, password } = await req.json().catch(() => ({}));
  if (!userId || !token || !password) {
    return NextResponse.json({ ok: false, message: "Missing fields." }, { status: 400 });
  }
  if (String(password).length < MIN_PASSWORD) {
    return NextResponse.json({ ok: false, message: `Password must be at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  }

  const candidates = await prisma.passwordResetToken.findMany({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
  });

  let matched = null;
  for (const c of candidates) {
    if (await bcrypt.compare(token, c.tokenHash)) {
      matched = c;
      break;
    }
  }
  if (!matched) {
    return NextResponse.json({ ok: false, message: "Invalid or expired token." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: matched.id }, data: { usedAt: new Date() } }),
  ]);
  await logActivity({ userId, action: "auth.password_reset_completed" });

  return NextResponse.json({ ok: true, message: "Password updated. You can now sign in." });
}
