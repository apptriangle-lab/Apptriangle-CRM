import {
  Archive,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { getPmsDocumentFileCategory, type PmsDocumentFileCategory } from "@/components/pms/documents/pmsDocumentUtils";

export type PmsDocumentVisual = {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  typeLabel: string;
};

const CATEGORY_VISUALS: Record<PmsDocumentFileCategory, PmsDocumentVisual> = {
  image: {
    icon: ImageIcon,
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    typeLabel: "Image",
  },
  pdf: {
    icon: FileText,
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    typeLabel: "PDF",
  },
  spreadsheet: {
    icon: FileSpreadsheet,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    typeLabel: "Spreadsheet",
  },
  document: {
    icon: FileText,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    typeLabel: "Document",
  },
  archive: {
    icon: Archive,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    typeLabel: "Archive",
  },
  other: {
    icon: FileText,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
    typeLabel: "File",
  },
};

export function getPmsDocumentVisual(fileName: string, fileType?: string | null): PmsDocumentVisual {
  const category = getPmsDocumentFileCategory(fileName, fileType);
  return CATEGORY_VISUALS[category];
}

export function getPmsDocumentVisualByCategory(category: PmsDocumentFileCategory): PmsDocumentVisual {
  return CATEGORY_VISUALS[category];
}

export function getPmsDocumentUploaderInitials(name?: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export const PMS_DOCUMENT_SOURCE_OPTIONS = [
  { value: "all", label: "All files" },
  { value: "project", label: "Project" },
  { value: "task", label: "Tasks" },
] as const;

export type PmsDocumentSourceFilter = (typeof PMS_DOCUMENT_SOURCE_OPTIONS)[number]["value"];

export const PMS_DOCUMENT_VIEW_OPTIONS = [
  { value: "list", label: "List" },
  { value: "grid", label: "Grid" },
] as const;

export type PmsDocumentViewMode = (typeof PMS_DOCUMENT_VIEW_OPTIONS)[number]["value"];

export const PMS_DOCUMENT_LOCATION_VISUAL = {
  project: {
    icon: FolderOpen,
    label: "Project files",
    pill: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  task: {
    icon: FileText,
    label: "Task attachment",
    pill: "bg-slate-100 text-slate-600 ring-slate-200/80",
  },
} as const;
