import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { LunchPollSummaryDto } from "@/lib/lunchApi";

export function exportLunchOrderSummaryPdf(summary: LunchPollSummaryDto) {
  const doc = new jsPDF();
  const dateLabel = summary.poll.date
    ? format(new Date(summary.poll.date + "T12:00:00"), "EEEE, MMM d, yyyy")
    : "—";

  doc.setFontSize(16);
  doc.text("Lunch Order Summary", 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`${summary.poll.title} · ${dateLabel}`, 14, 26);
  doc.text(`Office orders: ${summary.officeOrderCount} · Total votes: ${summary.totalVotes}`, 14, 33);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 40,
    head: [["Menu item", "Type", "Count"]],
    body: summary.options.map((o) => [o.label, o.optionType, String(o.count)]),
    theme: "grid",
    headStyles: { fillColor: [79, 70, 229] },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80;

  autoTable(doc, {
    startY: finalY + 10,
    head: [["Employee", "Choice", "Type"]],
    body: summary.voters.map((v) => [v.userName, v.optionLabel, v.optionType]),
    theme: "striped",
    headStyles: { fillColor: [51, 65, 85] },
  });

  const filename = `lunch-order-${summary.poll.date ?? "summary"}.pdf`;
  doc.save(filename);
}
