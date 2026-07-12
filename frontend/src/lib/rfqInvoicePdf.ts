import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RfqDetailDto } from "@/lib/api";
import { amountToWordsTaka } from "@/lib/numberToWords";
import {
  formatVatPercentDisplay,
  lineVatAmountForInvoiceLine,
  resolvedVatPercentForInvoiceLine,
} from "@/lib/rfqInvoiceLine";

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Totals block passed into the RFQ PDF (same shape as the on-screen summary). */
export type RfqPdfTotals = { sub: number; vat: number; total: number; vatPercent: number };

/** @deprecated Use {@link RfqPdfTotals} */
export type InvoiceTotals = RfqPdfTotals;

/** RGB — slate base + emerald accent (aligned with RFQ UI, print-safe) */
const C = {
  slate950: [15, 23, 42] as [number, number, number],
  slate900: [15, 23, 42] as [number, number, number],
  slate700: [51, 65, 85] as [number, number, number],
  slate600: [71, 85, 105] as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  slate100: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  emerald600: [5, 150, 105] as [number, number, number],
  emerald50: [236, 253, 245] as [number, number, number],
  amber500: [245, 158, 11] as [number, number, number],
};

export function downloadRfqInvoicePdf(
  data: RfqDetailDto,
  totals: RfqPdfTotals,
  variant: "approved" | "pending" = "approved",
): void {
  const doc = new jsPDF();
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxTextW = pageW - margin * 2;
  const contentW = pageW - margin * 2;

  const headerBarH = 38;
  doc.setFillColor(...C.slate950);
  doc.rect(0, 0, pageW, headerBarH, "F");

  doc.setFillColor(...C.emerald600);
  doc.rect(0, headerBarH, pageW, 3, "F");

  doc.setTextColor(...C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("RFQ", margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text("Pricing & summary", margin, 30);

  doc.setFontSize(9);
  const refLine = `Reference  ${data.salesId}`;
  doc.text(refLine, margin, 35);
  if ((data.versionNumber ?? 1) > 1) {
    doc.text(`Version ${data.versionNumber}`, margin + doc.getTextWidth(refLine) + 10, 35);
  }

  const statusLabel = variant === "pending" ? "AWAITING APPROVAL" : "APPROVED";
  const statusRgb = variant === "pending" ? C.amber500 : C.emerald600;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const pillPadX = 6;
  const pillH = 9;
  const tw = doc.getTextWidth(statusLabel) + pillPadX * 2;
  const pillX = pageW - margin - tw;
  const pillY = 11;
  doc.setFillColor(...statusRgb);
  if (typeof doc.roundedRect === "function") {
    doc.roundedRect(pillX, pillY, tw, pillH, 2, 2, "F");
  } else {
    doc.rect(pillX, pillY, tw, pillH, "F");
  }
  doc.setTextColor(...C.white);
  doc.text(statusLabel, pageW - margin - pillPadX, pillY + 6.2, { align: "right" });

  let y = headerBarH + 3 + 10;

  const infoH = 34;
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.35);
  if (typeof doc.roundedRect === "function") {
    doc.roundedRect(margin, y, contentW, infoH, 3, 3, "FD");
  } else {
    doc.rect(margin, y, contentW, infoH, "FD");
  }

  const colGap = 8;
  const colW = (contentW - colGap) / 2;
  const leftX = margin + 6;
  const rightX = margin + colW + colGap + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.slate500);
  doc.text("CUSTOMER", leftX, y + 9);
  doc.text("DATE", rightX, y + 9);

  doc.setFontSize(10);
  doc.setTextColor(...C.slate950);
  const customerName = data.customer?.name ?? "—";
  const custLines = doc.splitTextToSize(customerName, colW - 4);
  doc.text(custLines[0] ?? "—", leftX, y + 17);
  if (custLines.length > 1) {
    doc.text(custLines.slice(1).join(" "), leftX, y + 23);
  }

  const created = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })
    : "—";
  doc.setFont("helvetica", "bold");
  doc.text(created, rightX, y + 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.slate700);
  const prospect = data.deal?.prospect ?? "—";
  const prospectLines = doc.splitTextToSize(prospect, colW - 4);
  doc.text(prospectLines[0] ?? "—", leftX, y + 27);

  y += infoH + 10;

  const lineColW = contentW / 6;

  const tableBody = data.items.map((it) => {
    const unit = it.unitSellingPrice ?? 0;
    const line = unit * (it.quantity || 0);
    const vatPct = resolvedVatPercentForInvoiceLine(it, data.vatPercent);
    const lineVat = lineVatAmountForInvoiceLine(it, data.vatPercent);
    return [
      it.description,
      formatMoney(unit),
      String(it.quantity ?? 0),
      formatMoney(lineVat),
      formatVatPercentDisplay(vatPct),
      formatMoney(line),
    ];
  });

  if (tableBody.length === 0) {
    tableBody.push(["—", "—", "—", "—", "—", "—"]);
  }

  autoTable(doc, {
    head: [["Product", "Unit price", "Qty", "Line VAT", "VAT %", "Line total"]],
    body: tableBody,
    startY: y,
    styles: {
      fontSize: 9,
      cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
      overflow: "linebreak",
      cellWidth: "wrap",
      textColor: C.slate950,
      lineColor: C.slate200,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: C.slate950,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: lineColW, halign: "left" },
      1: { halign: "right", cellWidth: lineColW, fontStyle: "normal" },
      2: { halign: "right", cellWidth: lineColW, fontStyle: "normal" },
      3: { halign: "right", cellWidth: lineColW, fontStyle: "normal", textColor: C.slate950 },
      4: { halign: "right", cellWidth: lineColW, fontStyle: "normal" },
      5: { halign: "right", cellWidth: lineColW, fontStyle: "bold", textColor: C.slate950 },
    },
    margin: { left: margin, right: margin },
    tableLineColor: C.slate200,
    tableLineWidth: 0.2,
  });

  const lastAuto = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let cursorY = (lastAuto?.finalY ?? y + 40) + 10;
  const footerBlockMinH = 52;
  if (cursorY > pageH - footerBlockMinH) {
    doc.addPage();
    cursorY = 20;
  }

  const words = amountToWordsTaka(totals.total);
  doc.setFontSize(8);
  doc.setTextColor(...C.slate500);
  doc.setFont("helvetica", "bold");
  doc.text("AMOUNT IN WORDS", margin, cursorY);
  cursorY += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate900);
  doc.setFontSize(9);
  const wordLines = doc.splitTextToSize(words, maxTextW);
  doc.text(wordLines, margin, cursorY);
  cursorY += wordLines.length * 4.8 + 8;
  if (cursorY > pageH - footerBlockMinH) {
    doc.addPage();
    cursorY = 20;
  }

  if (data.notesOverall?.trim()) {
    doc.setFontSize(8);
    doc.setTextColor(...C.slate500);
    doc.setFont("helvetica", "bold");
    doc.text("NOTES", margin, cursorY);
    cursorY += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.slate700);
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(data.notesOverall.trim(), maxTextW);
    doc.text(noteLines, margin, cursorY);
    cursorY += noteLines.length * 4.8 + 8;
  }
  if (cursorY > pageH - footerBlockMinH) {
    doc.addPage();
    cursorY = 20;
  }

  const totalsW = 82;
  const totalsX = pageW - margin - totalsW;
  const totalsTop = cursorY - 4;
  const totalsH = 38;
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.25);
  doc.setFillColor(...C.emerald50);
  if (typeof doc.roundedRect === "function") {
    doc.roundedRect(totalsX, totalsTop, totalsW, totalsH, 2, 2, "FD");
  } else {
    doc.rect(totalsX, totalsTop, totalsW, totalsH, "FD");
  }
  doc.setDrawColor(...C.emerald600);
  doc.setLineWidth(1);
  doc.line(totalsX + 1, totalsTop + 2, totalsX + 1, totalsTop + totalsH - 2);

  let ty = totalsTop + 9;
  doc.setFontSize(9);
  doc.setTextColor(...C.slate600);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal", totalsX + 6, ty);
  doc.setTextColor(...C.slate950);
  doc.text(formatMoney(totals.sub), pageW - margin - 6, ty, { align: "right" });
  ty += 7;
  doc.setTextColor(...C.slate600);
  doc.text("VAT", totalsX + 6, ty);
  doc.setTextColor(...C.slate950);
  doc.text(formatMoney(totals.vat), pageW - margin - 6, ty, { align: "right" });
  ty += 9;

  doc.setDrawColor(...C.slate200);
  doc.line(totalsX + 5, ty - 1, pageW - margin - 5, ty - 1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.emerald600);
  doc.text("Total due", totalsX + 6, ty + 4);
  doc.text(formatMoney(totals.total), pageW - margin - 6, ty + 4, { align: "right" });

  const footY = pageH - 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.slate500);
  doc.text("RFQ document · amounts in your system currency", margin, footY);

  const safeName = data.salesId.replace(/[^\w.-]+/g, "_");
  doc.save(`rfq-${safeName}.pdf`);
}
