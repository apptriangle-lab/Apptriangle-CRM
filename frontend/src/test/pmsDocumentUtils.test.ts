import { describe, expect, it } from "vitest";
import {
  getPmsDocumentFileCategory,
  isPmsDocumentPreviewable,
} from "@/components/pms/documents/pmsDocumentUtils";

describe("pmsDocumentUtils", () => {
  it("classifies common file types", () => {
    expect(getPmsDocumentFileCategory("photo.png", "image/png")).toBe("image");
    expect(getPmsDocumentFileCategory("report.pdf", "application/pdf")).toBe("pdf");
    expect(getPmsDocumentFileCategory("sheet.xlsx")).toBe("spreadsheet");
    expect(getPmsDocumentFileCategory("notes.txt", "text/plain")).toBe("document");
  });

  it("detects previewable documents", () => {
    expect(isPmsDocumentPreviewable("photo.jpg", "image/jpeg")).toBe(true);
    expect(isPmsDocumentPreviewable("report.pdf", "application/pdf")).toBe(true);
    expect(isPmsDocumentPreviewable("sheet.xlsx")).toBe(false);
  });
});
