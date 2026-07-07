import { PrismaClient, Role, EmployeeStatus, ProjectStatus, Priority, TaskStatus, MilestoneStatus, NotificationType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "Password123!";

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("🌱 Seeding Wesualize…");

  // Clean (order matters due to FKs)
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

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // Departments
  const deptNames = ["Animation", "3D", "Design", "Motion", "Post-Production", "Management"];
  const departments = Object.fromEntries(
    await Promise.all(
      deptNames.map(async (name) => [name, await prisma.department.create({ data: { name } })] as const)
    )
  );

  // Helper to create user+employee
  async function makeEmployee(opts: {
    email: string;
    role: Role;
    name: string;
    designation: string;
    department: string;
    status?: EmployeeStatus;
    avatar: number;
    capacity?: number;
  }) {
    const user = await prisma.user.create({
      data: { email: opts.email, passwordHash: hash, role: opts.role },
    });
    return prisma.employee.create({
      data: {
        userId: user.id,
        name: opts.name,
        designation: opts.designation,
        departmentId: departments[opts.department].id,
        status: opts.status ?? EmployeeStatus.ACTIVE,
        phone: "+1 555 0" + (100 + opts.avatar),
        avatarUrl: `https://i.pravatar.cc/150?img=${opts.avatar}`,
        weeklyCapacityHours: opts.capacity ?? 40,
        joiningDate: daysFromNow(-Math.floor(Math.random() * 900) - 60),
      },
      include: { user: true },
    });
  }

  // CEO / Admin
  const ceo = await makeEmployee({ email: "admin@wesualize.com", role: Role.ADMIN, name: "Wesley Vaughn", designation: "CEO", department: "Management", avatar: 12, capacity: 20 });

  // Team leads
  const lead1 = await makeEmployee({ email: "lead@wesualize.com", role: Role.TEAM_LEAD, name: "Mara Lindqvist", designation: "Project Manager", department: "Management", avatar: 5 });
  const lead2 = await makeEmployee({ email: "lead2@wesualize.com", role: Role.TEAM_LEAD, name: "Diego Santos", designation: "Project Manager", department: "Management", avatar: 8 });

  // Employees
  const emps = await Promise.all([
    makeEmployee({ email: "ana@wesualize.com", role: Role.EMPLOYEE, name: "Ana Petrova", designation: "Animator", department: "Animation", avatar: 1 }),
    makeEmployee({ email: "kenji@wesualize.com", role: Role.EMPLOYEE, name: "Kenji Tanaka", designation: "3D Artist", department: "3D", avatar: 3 }),
    makeEmployee({ email: "lena@wesualize.com", role: Role.EMPLOYEE, name: "Lena Hofmann", designation: "Illustrator", department: "Design", avatar: 9 }),
    makeEmployee({ email: "omar@wesualize.com", role: Role.EMPLOYEE, name: "Omar Haddad", designation: "Motion Designer", department: "Motion", avatar: 11 }),
    makeEmployee({ email: "sara@wesualize.com", role: Role.EMPLOYEE, name: "Sara Nowak", designation: "Video Editor", department: "Post-Production", avatar: 16 }),
    makeEmployee({ email: "theo@wesualize.com", role: Role.EMPLOYEE, name: "Theo Marchetti", designation: "3D Artist", department: "3D", avatar: 13 }),
    makeEmployee({ email: "priya@wesualize.com", role: Role.EMPLOYEE, name: "Priya Nair", designation: "Animator", department: "Animation", avatar: 20 }),
    makeEmployee({ email: "noah@wesualize.com", role: Role.EMPLOYEE, name: "Noah Berg", designation: "Motion Designer", department: "Motion", status: EmployeeStatus.ON_LEAVE, avatar: 33 }),
    makeEmployee({ email: "iris@wesualize.com", role: Role.EMPLOYEE, name: "Iris Chen", designation: "Illustrator", department: "Design", avatar: 25 }),
  ]);

  // Clients
  const clients = await Promise.all([
    prisma.client.create({ data: { clientName: "Helena Ross", companyName: "Nimbus Studios", email: "helena@nimbus.io", phone: "+1 555 7788", country: "USA", notes: "Recurring brand campaigns." } }),
    prisma.client.create({ data: { clientName: "Yusuf Demir", companyName: "Aurora Games", email: "yusuf@auroragames.com", country: "Germany", notes: "Game cinematics." } }),
    prisma.client.create({ data: { clientName: "Claire Dubois", companyName: "Maison Lumière", email: "claire@lumiere.fr", country: "France" } }),
    prisma.client.create({ data: { clientName: "Raj Malhotra", companyName: "Spice Route Media", country: "India", notes: "Explainer series." } }),
  ]);

  // Projects
  const projectsData = [
    { name: "Nimbus Rebrand Sizzle", client: 0, lead: lead1, status: ProjectStatus.IN_PROGRESS, priority: Priority.HIGH, deadline: daysFromNow(14), budget: 48000 },
    { name: "Aurora Boss Battle Cinematic", client: 1, lead: lead2, status: ProjectStatus.IN_PROGRESS, priority: Priority.CRITICAL, deadline: daysFromNow(4), budget: 120000 },
    { name: "Lumière Perfume Launch", client: 2, lead: lead1, status: ProjectStatus.REVIEW, priority: Priority.MEDIUM, deadline: daysFromNow(9), budget: 65000 },
    { name: "Spice Route Explainer S2", client: 3, lead: lead2, status: ProjectStatus.PLANNING, priority: Priority.MEDIUM, deadline: daysFromNow(40), budget: 30000 },
    { name: "Aurora Title Sequence", client: 1, lead: lead2, status: ProjectStatus.ON_HOLD, priority: Priority.LOW, deadline: daysFromNow(-3), budget: 22000 },
    { name: "Nimbus Holiday Spot", client: 0, lead: lead1, status: ProjectStatus.COMPLETED, priority: Priority.HIGH, deadline: daysFromNow(-20), budget: 54000 },
  ];

  const projects = [];
  for (const p of projectsData) {
    const project = await prisma.project.create({
      data: {
        name: p.name,
        clientId: clients[p.client].id,
        leadId: p.lead.id,
        status: p.status,
        priority: p.priority,
        deadline: p.deadline,
        startDate: daysFromNow(-30),
        budget: p.budget,
        description: `Creative production engagement for ${clients[p.client].companyName}.`,
      },
    });
    projects.push(project);
  }

  // Project members — distribute employees (leave one employee unassigned on purpose)
  const assignments: [number, number[]][] = [
    [0, [0, 2, 3]],
    [1, [1, 5, 0, 3]], // Ana (0) is on two active projects -> multi-project
    [2, [2, 4]],
    [3, [6]],
    [4, [1]],
    [5, [4, 0]],
  ];
  for (const [pIdx, empIdxs] of assignments) {
    for (const e of empIdxs) {
      await prisma.projectMember.create({
        data: { projectId: projects[pIdx].id, employeeId: emps[e].id, roleInProject: emps[e].designation, allocationPct: 60 },
      });
    }
  }
  // emps[8] (Iris) intentionally unassigned -> "unassigned employee" BI signal.

  // Milestones
  await prisma.milestone.createMany({
    data: [
      { projectId: projects[0].id, title: "Storyboard approved", dueDate: daysFromNow(-5), status: MilestoneStatus.REACHED },
      { projectId: projects[0].id, title: "Animatic delivery", dueDate: daysFromNow(3), status: MilestoneStatus.PENDING },
      { projectId: projects[1].id, title: "Layout lock", dueDate: daysFromNow(-2), status: MilestoneStatus.MISSED },
      { projectId: projects[1].id, title: "Final render", dueDate: daysFromNow(3), status: MilestoneStatus.PENDING },
    ],
  });

  // Tasks — create a spread incl. overdue, completed today, and overload Ana
  const today = new Date();
  const taskSpecs = [
    { project: 0, assignee: 0, title: "Block out scene 1", status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, due: daysFromNow(2), est: 12, act: 6 },
    { project: 0, assignee: 2, title: "Character color keys", status: TaskStatus.REVIEW, priority: Priority.MEDIUM, due: daysFromNow(1), est: 8, act: 7 },
    { project: 0, assignee: 3, title: "Logo motion treatment", status: TaskStatus.DONE, priority: Priority.MEDIUM, due: daysFromNow(-1), est: 6, act: 6, completed: today },
    { project: 1, assignee: 0, title: "Hero animation pass", status: TaskStatus.IN_PROGRESS, priority: Priority.CRITICAL, due: daysFromNow(-1), est: 20, act: 14 },
    { project: 1, assignee: 1, title: "Environment sculpt", status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, due: daysFromNow(1), est: 18, act: 10 },
    { project: 1, assignee: 5, title: "Lookdev boss model", status: TaskStatus.TODO, priority: Priority.HIGH, due: daysFromNow(-2), est: 16, act: 0 },
    { project: 1, assignee: 0, title: "Secondary motion fixes", status: TaskStatus.TODO, priority: Priority.MEDIUM, due: daysFromNow(3), est: 10, act: 0 },
    { project: 1, assignee: 0, title: "Camera shake polish", status: TaskStatus.TODO, priority: Priority.LOW, due: daysFromNow(5), est: 5, act: 0 },
    { project: 1, assignee: 0, title: "Render farm submission", status: TaskStatus.TODO, priority: Priority.HIGH, due: daysFromNow(2), est: 4, act: 0 },
    { project: 1, assignee: 0, title: "Comp QA notes", status: TaskStatus.TODO, priority: Priority.MEDIUM, due: daysFromNow(4), est: 6, act: 0 },
    { project: 2, assignee: 2, title: "Bottle illustration set", status: TaskStatus.DONE, priority: Priority.MEDIUM, due: daysFromNow(-3), est: 14, act: 15, completed: today },
    { project: 2, assignee: 4, title: "Edit teaser 30s", status: TaskStatus.REVIEW, priority: Priority.HIGH, due: daysFromNow(2), est: 9, act: 8 },
    { project: 3, assignee: 6, title: "Script breakdown", status: TaskStatus.TODO, priority: Priority.LOW, due: daysFromNow(10), est: 6, act: 0 },
    { project: 5, assignee: 4, title: "Final delivery package", status: TaskStatus.DONE, priority: Priority.HIGH, due: daysFromNow(-18), est: 5, act: 5, completed: daysFromNow(-19) },
    { project: 5, assignee: 0, title: "Holiday spot animation", status: TaskStatus.DONE, priority: Priority.HIGH, due: daysFromNow(-22), est: 30, act: 32, completed: daysFromNow(-21) },
  ];

  for (const t of taskSpecs) {
    await prisma.task.create({
      data: {
        title: t.title,
        projectId: projects[t.project].id,
        assigneeId: emps[t.assignee].id,
        assignedById: (t.project % 2 === 0 ? lead1 : lead2).userId,
        status: t.status,
        priority: t.priority,
        dueDate: t.due,
        estimatedHours: t.est,
        actualHours: t.act,
        completedAt: t.completed ?? null,
      },
    });
  }

  // Notifications for the CEO
  await prisma.notification.createMany({
    data: [
      { userId: ceo.userId, type: NotificationType.PROJECT_DELAYED, title: "Aurora Title Sequence is overdue", body: "Deadline passed 3 days ago.", link: "/projects" },
      { userId: ceo.userId, type: NotificationType.OVERLOADED, title: "Ana Petrova is overloaded", body: "6 active tasks across 2 projects.", link: "/employees" },
      { userId: ceo.userId, type: NotificationType.DEADLINE_APPROACHING, title: "Aurora Boss Battle due in 4 days", link: "/projects" },
    ],
  });

  // Activity log samples
  await prisma.activityLog.createMany({
    data: [
      { userId: ceo.userId, action: "auth.login", entityType: "User", entityId: ceo.userId },
      { userId: lead1.userId, action: "project.update", entityType: "Project", entityId: projects[0].id, metadata: { status: "IN_PROGRESS" } },
      { userId: lead2.userId, action: "task.create", entityType: "Task", entityId: projects[1].id },
    ],
  });

  console.log("✅ Seed complete.");
  console.log("   Login accounts (password: " + DEFAULT_PASSWORD + ")");
  console.log("   • admin@wesualize.com  (CEO / Admin)");
  console.log("   • lead@wesualize.com   (Team Lead)");
  console.log("   • ana@wesualize.com    (Employee)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
