"use client";

import {
  FileText, FileSpreadsheet, FileDown, Users, Gauge, CheckCircle2, Boxes, Scale, CalendarClock, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui/primitives";

const REPORTS: { key: string; title: string; desc: string; icon: React.ElementType }[] = [
  { key: "employee-productivity", title: "Employee Productivity", desc: "Tasks completed, totals and efficiency per employee.", icon: Users },
  { key: "team-utilization", title: "Team Utilization", desc: "Allocated vs available capacity across the team.", icon: Gauge },
  { key: "project-completion", title: "Project Completion", desc: "Completion %, overdue tasks and health per project.", icon: CheckCircle2 },
  { key: "resource-allocation", title: "Resource Allocation", desc: "Who is assigned to which project and at what allocation.", icon: Boxes },
  { key: "workload", title: "Workload Distribution", desc: "Open/overdue tasks and overload flags per employee.", icon: Scale },
  { key: "deadline-risk", title: "Deadline Risk", desc: "Projects ranked by deadline pressure and risk.", icon: CalendarClock },
  { key: "time-log", title: "Time Log", desc: "Attendance and task hours per employee, this week.", icon: Clock },
];

function exportUrl(key: string, format: string) {
  return `/api/reports/${key}/export?format=${format}`;
}

export function ReportsClient() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {REPORTS.map((r) => (
        <Card key={r.key} className="flex flex-col transition-shadow hover:shadow-[0_2px_8px_rgba(16,24,40,0.08)]">
          <CardHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <r.icon className="h-5 w-5" />
            </div>
            <CardTitle>{r.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{r.desc}</p>
          </CardHeader>
          <CardContent className="mt-auto flex flex-wrap gap-2 border-t border-border/70 pt-4">
            <a href={exportUrl(r.key, "pdf")}><Button variant="outline" size="sm"><FileText className="h-4 w-4" /> PDF</Button></a>
            <a href={exportUrl(r.key, "xlsx")}><Button variant="outline" size="sm"><FileSpreadsheet className="h-4 w-4" /> Excel</Button></a>
            <a href={exportUrl(r.key, "csv")}><Button variant="outline" size="sm"><FileDown className="h-4 w-4" /> CSV</Button></a>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
