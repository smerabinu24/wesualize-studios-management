import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/lib/api";
import { logActivity } from "@/lib/audit";

const MIN_PASSWORD = 8;

/** Change the signed-in user's own password (verifies the current one first). */
export const PATCH = withAuth(null, async (req, ctx) => {
  const { currentPassword, newPassword } = await req.json().catch(() => ({}));

  if (!currentPassword || !newPassword) {
    return ok({ error: "Both current and new password are required." }, 400);
  }
  if (String(newPassword).length < MIN_PASSWORD) {
    return ok({ error: `New password must be at least ${MIN_PASSWORD} characters.` }, 400);
  }

  const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
  if (!user) return ok({ error: "Not found" }, 404);

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return ok({ error: "Current password is incorrect." }, 400);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await logActivity({ userId: user.id, action: "account.password_changed" });

  return ok({ ok: true, message: "Password updated successfully." });
});
