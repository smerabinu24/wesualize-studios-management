import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { withAuth } from "@/lib/api";
import { buildReport, type ReportKey } from "@/lib/reports";
import { logActivity } from "@/lib/audit";

export const GET = withAuth("report:export", async (req, ctx, params) => {
  const format = new URL(req.url).searchParams.get("format") ?? "csv";
  const report = await buildReport(params.key as ReportKey);
  await logActivity({ userId: ctx.user.id, action: "report.export", entityType: "Report", entityId: params.key, metadata: { format } });

  const filename = `${params.key}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    const csv = Papa.unparse({ fields: report.columns, data: report.rows });
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${filename}.csv"` },
    });
  }

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(report.title.slice(0, 31));
    ws.addRow(report.columns);
    ws.getRow(1).font = { bold: true };
    report.rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c) => (c.width = 22));
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    let page = pdf.addPage([842, 595]); // A4 landscape
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const margin = 40;
    let y = 555;

    page.drawText(`Wesualize — ${report.title}`, { x: margin, y, size: 16, font: bold, color: rgb(0.145, 0.388, 0.922) });
    y -= 14;
    page.drawText(new Date().toLocaleString(), { x: margin, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 24;

    const colWidth = (842 - margin * 2) / report.columns.length;
    const drawRow = (cells: (string | number)[], f: typeof font, size: number) => {
      cells.forEach((c, i) => {
        page.drawText(String(c).slice(0, 28), { x: margin + i * colWidth, y, size, font: f });
      });
      y -= size + 8;
    };

    drawRow(report.columns, bold, 10);
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: 802, y: y + 4 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 4;

    for (const row of report.rows) {
      if (y < margin) {
        page = pdf.addPage([842, 595]);
        y = 555;
      }
      drawRow(row, font, 9);
    }

    const bytes = Buffer.from(await pdf.save());
    return new NextResponse(bytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"` },
    });
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
});
