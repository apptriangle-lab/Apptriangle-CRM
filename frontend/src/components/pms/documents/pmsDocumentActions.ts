import { pmsApi, type PmsProjectDocumentDto } from "@/lib/pmsApi";

export async function downloadPmsProjectDocument(document: PmsProjectDocumentDto): Promise<void> {
  if (document.source === "project") {
    await pmsApi.downloadProjectDocument(document.projectId, document.id, document.fileName);
    return;
  }
  if (!document.taskId) {
    throw new Error("Task attachment is missing task information");
  }
  await pmsApi.downloadAttachment(document.taskId, document.id, document.fileName);
}

export async function openPmsProjectDocument(document: PmsProjectDocumentDto): Promise<void> {
  if (document.source === "project") {
    await pmsApi.openProjectDocument(document.projectId, document.id);
    return;
  }
  if (!document.taskId) {
    throw new Error("Task attachment is missing task information");
  }
  await pmsApi.openAttachment(document.taskId, document.id);
}
