import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";

/**
 * Initiates a password reset. Always returns 200 to avoid email enumeration.
 * In production the token would be emailed; here we return it in dev only.
 */
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({ email: "" }));
  const generic = { ok: true, message: "If that account exists, a reset link has been sent." };

  if (!email) return NextResponse.json(generic);

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
  if (!user) return NextResponse.json(generic);

  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(raw, 10);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 1000 * 60 * 30) },
  });
  await logActivity({ userId: user.id, action: "auth.password_reset_requested" });

  const devToken = process.env.NODE_ENV !== "production" ? { devToken: raw, devUserId: user.id } : {};
  return NextResponse.json({ ...generic, ...devToken });
}
