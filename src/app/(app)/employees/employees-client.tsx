"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2, AlertTriangle, Users } from "lucide-react";
import { Button, Input, Select, Label, Badge, Avatar, EmptyState } from "@/components/ui/primitives";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import type { EmployeeWorkload } from "@/lib/bi";

type Dept = { id: string; name: string };
type Row = {
  id: string;
  name: string;
  designation: string;
  status: string;
  avatarUrl: string | null;
  user: { email: string; role: string } | null;
  department: { name: string } | null;
  /** Only sent to clients whose user holds `finance:manage`. */
  hourlyRate?: string | number | null;
};

export function EmployeesClient({
  employees,
  workload,
  departments,
  canManage,
  canManageFinance = false,
}: {
  employees: Row[];
  workload: Record<string, EmployeeWorkload>;
  departments: Dept[];
  canManage: boolean;
  canManageFinance?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = employees.filter(
    (e) =>
      (!q || e.name.toLowerCase().includes(q.toLowerCase()) || e.designation.toLowerCase().includes(q.toLowerCase())) &&
      (!status || e.status === status)
  );

  async function save(form: FormData) {
    setSaving(true);
    const payload = Object.fromEntries(form.entries());
    const url = editing ? `/api/employees/${editing.id}` : "/api/employees";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      setEditing(null);
      router.refresh();
    } else {
      alert("Save failed. Check the fields and try again.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this employee? This deletes their account.")) return;
    await fetch(`/api/employees/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search employees…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search employees" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_LEAVE">On leave</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
        {canManage && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Add employee
          </Button>
        )}
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>Employee</Th>
            <Th>Designation</Th>
            <Th>Department</Th>
            <Th>Workload</Th>
            <Th>Status</Th>
            {canManage && <Th className="text-right">Actions</Th>}
          </tr>
        </Thead>
        <tbody>
          {filtered.map((e) => {
            const w = workload[e.id];
            return (
              <Tr key={e.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={e.name} src={e.avatarUrl} />
                    <div>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{e.user?.email}</div>
                    </div>
                  </div>
                </Td>
                <Td>{e.designation}</Td>
                <Td>{e.department?.name ?? "—"}</Td>
                <Td>
                  {w ? (
                    <div className="flex items-center gap-2">
                      <span className="tabular text-xs">{w.openTasks} tasks · {w.activeProjects} proj · {w.utilizationPct}%</span>
                      {w.overloaded && <Badge tone="destructive"><AlertTriangle className="h-3 w-3" /> Overloaded</Badge>}
                      {w.activeProjects === 0 && e.status === "ACTIVE" && <Badge tone="warning">Unassigned</Badge>}
                    </div>
                  ) : "—"}
                </Td>
                <Td>
                  <Badge tone={e.status === "ACTIVE" ? "success" : e.status === "ON_LEAVE" ? "warning" : "muted"}>
                    {e.status.replace("_", " ").toLowerCase()}
                  </Badge>
                </Td>
                {canManage && (
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${e.name}`} onClick={() => { setEditing(e); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Remove ${e.name}`} onClick={() => remove(e.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </Td>
                )}
              </Tr>
            );
          })}
        </tbody>
      </Table>
      {filtered.length === 0 && (
        <EmptyState
          icon={Users}
          title="No employees found"
          description={q || status ? "No employees match your current search or filters." : "Add your first team member to get started."}
          action={canManage ? <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add employee</Button> : undefined}
          className="mt-4"
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit employee" : "Add employee"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="emp-form" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <form id="emp-form" action={save} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" defaultValue={editing?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" defaultValue={editing?.user?.email} required />
            </div>
            <div>
              <Label htmlFor="designation">Designation *</Label>
              <Input id="designation" name="designation" defaultValue={editing?.designation} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="departmentId">Department</Label>
              <Select id="departmentId" name="departmentId" defaultValue={departments.find((d) => d.name === editing?.department?.name)?.id ?? ""}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="role">System role</Label>
              <Select id="role" name="role" defaultValue={editing?.user?.role ?? "EMPLOYEE"}>
                <option value="EMPLOYEE">Employee</option>
                <option value="TEAM_LEAD">Team Lead</option>
                <option value="ADMIN">Administrator</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={editing?.status ?? "ACTIVE"}>
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On leave</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="weeklyCapacityHours">Weekly capacity (h)</Label>
              <Input id="weeklyCapacityHours" name="weeklyCapacityHours" type="number" min={1} max={80} defaultValue={40} />
            </div>
          </div>
          {canManageFinance && (
            <div>
              <Label htmlFor="hourlyRate">Hourly rate <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="hourlyRate" name="hourlyRate" type="number" min={0} step="0.01"
                placeholder="e.g. 500" defaultValue={editing?.hourlyRate ?? ""} />
              <p className="mt-1 text-xs text-muted-foreground">
                Used to cost logged hours on the Project Costs page. Visible to administrators only.
              </p>
            </div>
          )}
          {!editing && <p className="text-xs text-muted-foreground">Default password <code className="tabular">Password123!</code> is set; the employee can reset it.</p>}
        </form>
      </Modal>
    </>
  );
}
