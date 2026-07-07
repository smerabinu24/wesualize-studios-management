"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2, Briefcase } from "lucide-react";
import { Button, Input, Label, Textarea, Badge, EmptyState } from "@/components/ui/primitives";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";

type Row = {
  id: string; clientName: string; companyName: string | null; email: string | null;
  phone: string | null; country: string | null; notes: string | null;
  _count: { projects: number };
};

export function ClientsClient({ clients, canManage }: { clients: Row[]; canManage: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const filtered = clients.filter((c) => !q || `${c.clientName} ${c.companyName}`.toLowerCase().includes(q.toLowerCase()));

  async function save(form: FormData) {
    const payload = Object.fromEntries(form.entries());
    const res = await fetch(editing ? `/api/clients/${editing.id}` : "/api/clients", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) { setOpen(false); setEditing(null); router.refresh(); }
    else alert("Save failed.");
  }
  async function remove(id: string) {
    if (!confirm("Delete this client?")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search clients…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
        </div>
        {canManage && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add client</Button>}
      </div>

      <Table>
        <Thead>
          <tr><Th>Client</Th><Th>Company</Th><Th>Contact</Th><Th>Country</Th><Th>Projects</Th>{canManage && <Th className="text-right">Actions</Th>}</tr>
        </Thead>
        <tbody>
          {filtered.map((c) => (
            <Tr key={c.id}>
              <Td className="font-medium">{c.clientName}</Td>
              <Td>{c.companyName ?? "—"}</Td>
              <Td className="text-sm text-muted-foreground">{c.email ?? c.phone ?? "—"}</Td>
              <Td>{c.country ?? "—"}</Td>
              <Td><Badge tone="primary">{c._count.projects}</Badge></Td>
              {canManage && (
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label="Edit client" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete client" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </Td>
              )}
            </Tr>
          ))}
        </tbody>
      </Table>
      {filtered.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="No clients found"
          description={q ? "No clients match your search." : "Add your first client to start linking projects."}
          action={canManage ? <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add client</Button> : undefined}
          className="mt-4"
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit client" : "Add client"}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button form="client-form" type="submit">Save</Button></>}>
        <form id="client-form" action={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="clientName">Contact name *</Label><Input id="clientName" name="clientName" defaultValue={editing?.clientName} required /></div>
            <div><Label htmlFor="companyName">Company</Label><Input id="companyName" name="companyName" defaultValue={editing?.companyName ?? ""} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} /></div>
            <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} /></div>
          </div>
          <div><Label htmlFor="country">Country</Label><Input id="country" name="country" defaultValue={editing?.country ?? ""} /></div>
          <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} /></div>
        </form>
      </Modal>
    </>
  );
}
