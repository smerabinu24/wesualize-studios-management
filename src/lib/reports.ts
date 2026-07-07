/** Report dataset builders — shared by the Reports UI and the export endpoint. */
import { prisma } from "@/lib/prisma";
import { getEmployeeWorkload, getProjectHealth, getTeamUtilization } from "@/lib/bi";
import { TaskStatus } from "@prisma/client";

export type ReportKey =
  | "employee-productivity"
  | "team-utilization"
  | "project-completion"
  | "resource-allocation"
  | "workload"
  | "deadline-risk";

export type ReportTable = { title: string; columns: string[]; rows: (string | number)[][] };

export async function buildReport(key: ReportKey): Promise<ReportTable> {
  switch (key) {
    case "employee-productivity": {
      const emps = await prisma.employee.findMany({ include: { tasks: true } });
      const rows = emps.map((e) => {
        const done = e.tasks.filter((t) => t.status === TaskStatus.DONE);
        const est = done.reduce((s, t) => s + t.estimatedHours, 0);
        const act = done.reduce((s, t) => s + t.actualHours, 0);
        const eff = act > 0 ? Math.round((est / act) * 100) : 0;
        return [e.name, e.designation, done.length, e.tasks.length, `${eff}%`];
      });
      return { title: "Employee Productivity", columns: ["Employee", "Designation", "Tasks Done", "Total Tasks", "Efficiency"], rows };
    }
    case "team-utilization": {
      const wl = await getEmployeeWorkload();
      const util = await getTeamUtilization();
      const rows = wl.map((w) => [w.name, w.activeProjects, w.openTasks, `${w.estimatedHours}h`, `${w.capacity}h`, `${w.utilizationPct}%`]);
      rows.push(["— TEAM TOTAL —", "", "", `${util.totalAllocated}h`, `${util.totalCapacity}h`, `${util.utilizationPct}%`]);
      return { title: "Team Utilization", columns: ["Employee", "Active Projects", "Open Tasks", "Allocated", "Capacity", "Utilization"], rows };
    }
    case "project-completion": {
      const health = await getProjectHealth();
      const rows = health.map((p) => [p.name, p.status, `${p.completionRate}%`, p.overdueTasks, `${p.healthScore}/100`, p.risk.toUpperCase()]);
      return { title: "Project Completion", columns: ["Project", "Status", "Completion", "Overdue Tasks", "Health", "Risk"], rows };
    }
    case "resource-allocation": {
      const projects = await prisma.project.findMany({ include: { members: { include: { employee: true } }, client: true } });
      const rows = projects.flatMap((p) =>
        p.members.map((m) => [p.name, p.client?.companyName ?? "—", m.employee.name, m.employee.designation, `${m.allocationPct}%`])
      );
      return { title: "Resource Allocation", columns: ["Project", "Client", "Employee", "Role", "Allocation"], rows };
    }
    case "workload": {
      const wl = await getEmployeeWorkload();
      const rows = wl.map((w) => [w.name, w.openTasks, w.overdueTasks, `${w.utilizationPct}%`, w.overloaded ? "OVERLOADED" : "OK"]);
      return { title: "Workload Distribution", columns: ["Employee", "Open Tasks", "Overdue", "Utilization", "Flag"], rows };
    }
    case "deadline-risk": {
      const health = await getProjectHealth();
      const rows = health
        .filter((p) => p.deadline)
        .map((p) => [p.name, p.deadline!.toLocaleDateString(), `${p.completionRate}%`, p.overdueTasks, p.risk.toUpperCase()]);
      return { title: "Deadline Risk", columns: ["Project", "Deadline", "Completion", "Overdue Tasks", "Risk"], rows };
    }
  }
}
