import { PageHeader } from "@/components/page-header";
import { ReportsClient } from "./reports-client";
import { requireCan } from "@/lib/session";

export default async function ReportsPage() {
  await requireCan("report:export");
  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="Generate and export operational reports (PDF · Excel · CSV)." />
      <ReportsClient />
    </div>
  );
}
