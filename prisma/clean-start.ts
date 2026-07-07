/**
 * Clean start for real use:
 *  - wipes ALL demo data
 *  - keeps the department structure (edit later as needed)
 *  - creates the real admin account
 *
 * Run with:  npm run db:clean
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "imsidbinu@gmail.com";
const ADMIN_NAME = "Administrator";
const ADMIN_PASSWORD = "Password123!";

const DEPARTMENTS = ["Animation", "3D", "Design", "Motion", "Post-Production", "Management"];

async function main() {
  console.log("🧹 Clearing all data…");
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();

  console.log("🏢 Creating departments…");
  const depts: Record<string, string> = {};
  for (const name of DEPARTMENTS) {
    const d = await prisma.department.create({ data: { name } });
    depts[name] = d.id;
  }

  console.log("👤 Creating admin account…");
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.employee.create({
    data: {
      name: ADMIN_NAME,
      designation: "Administrator",
      department: { connect: { id: depts["Management"] } },
      user: { create: { email: ADMIN_EMAIL, passwordHash, role: Role.ADMIN } },
    },
  });

  console.log("\n✅ Clean start complete. The app is now empty and ready for real data.");
  console.log(`   Admin login:  ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}`);
  console.log("   Next: sign in and add your real employees, clients, projects and tasks.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
