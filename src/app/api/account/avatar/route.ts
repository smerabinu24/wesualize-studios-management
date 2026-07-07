import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/lib/api";
import { logActivity } from "@/lib/audit";

// Max stored avatar payload (data URL). 256x256 JPEG lands well under this.
const MAX_LEN = 300_000;

/** Set the signed-in user's own profile photo (stored as a compressed data URL). */
export const PATCH = withAuth(null, async (req, ctx) => {
  if (!ctx.user.employeeId) return ok({ error: "No employee profile linked to this account." }, 400);

  const { dataUrl } = await req.json().catch(() => ({}));

  // Allow clearing the photo.
  if (dataUrl === null || dataUrl === "") {
    await prisma.employee.update({ where: { id: ctx.user.employeeId }, data: { avatarUrl: null } });
    return ok({ ok: true, avatarUrl: null });
  }

  if (typeof dataUrl !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) {
    return ok({ error: "Please upload a PNG, JPEG or WebP image." }, 400);
  }
  if (dataUrl.length > MAX_LEN) {
    return ok({ error: "Image is too large. Please choose a smaller photo." }, 400);
  }

  await prisma.employee.update({ where: { id: ctx.user.employeeId }, data: { avatarUrl: dataUrl } });
  await logActivity({ userId: ctx.user.id, action: "account.avatar_updated" });
  return ok({ ok: true, avatarUrl: dataUrl });
});
