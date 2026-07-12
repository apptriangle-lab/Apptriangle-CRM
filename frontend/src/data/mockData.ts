export type Role = "admin" | "user";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  location: string;
  country: string;
  currencyId: string;
  kamUserId: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  companyId: string;
  designation: string | null;
  mobile: string;
  email: string | null;
  createdByUserId?: string;
  createdAt: string;
}

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskActionType = "created" | "updated" | "status_changed";

export interface Task {
  id: string;
  title: string;
  note: string | null;
  companyId: string;
  dueDatetime: string;
  assignByUserId: string;
  assignToUserId: string;
  status: TaskStatus;
  createdAt: string;
}

export type SalesCategory = "hot" | "warm" | "cold";
export type SalesStatus = string;

export interface Sale {
  id: string;
  companyId: string;
  category: SalesCategory;
  prospect: string;
  expectedClosingDate: string;
  expectedRevenue: number;
  status: SalesStatus;
  nextAction?: string;
  nextActionDate?: string;
  createdByUserId: string;
  createdAt: string;
}

export interface TaskActivityLog {
  id: string;
  taskId: string;
  actionType: TaskActionType;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  note: string | null;
  actorUserId: string;
  createdAt: string;
}

export interface SalesStatusLog {
  id: string;
  salesId: string;
  fromStatus: SalesStatus;
  toStatus: SalesStatus;
  note: string;
  changedByUserId: string;
  changedAt: string;
}

export interface SalesActivity {
  id: string;
  salesId: string;
  title: string;
  note: string;
  date: string;
  createdByUserId: string;
  createdAt: string;
}

// --- Mock Data ---

export const mockUsers: User[] = [
  { id: "u1", name: "Alice Johnson", email: "alice@company.com", phone: "+1 555-0101", role: "admin", isActive: true, createdAt: "2024-01-10" },
  { id: "u2", name: "Bob Smith", email: "bob@company.com", phone: "+1 555-0102", role: "user", isActive: true, createdAt: "2024-02-15" },
  { id: "u3", name: "Carol Davis", email: "carol@company.com", phone: "+1 555-0103", role: "user", isActive: true, createdAt: "2024-03-01" },
  { id: "u4", name: "Dan Lee", email: "dan@company.com", phone: "+1 555-0104", role: "user", isActive: true, createdAt: "2024-04-20" },
  { id: "u5", name: "Eve Torres", email: "eve@company.com", phone: "+1 555-0105", role: "user", isActive: false, createdAt: "2024-05-10" },
];

export { ALL_COUNTRIES as COUNTRIES } from "./countries";

export const mockCompanies: Company[] = [
  { id: "c1", name: "Acme Corp", location: "San Francisco, CA", country: "United States", currencyId: "", kamUserId: "u2", createdByUserId: "u1", createdAt: "2024-01-15", updatedAt: "2024-01-15" },
  { id: "c2", name: "Globex Inc", location: "New York, NY", country: "United States", currencyId: "", kamUserId: "u3", createdByUserId: "u1", createdAt: "2024-02-01", updatedAt: "2024-02-01" },
  { id: "c3", name: "Initech", location: "London", country: "United Kingdom", currencyId: "", kamUserId: "u2", createdByUserId: "u2", createdAt: "2024-02-20", updatedAt: "2024-02-20" },
  { id: "c4", name: "Umbrella Corp", location: "Mumbai", country: "India", currencyId: "", kamUserId: "u4", createdByUserId: "u3", createdAt: "2024-03-10", updatedAt: "2024-03-10" },
  { id: "c5", name: "Stark Industries", location: "Berlin", country: "Germany", currencyId: "", kamUserId: "u3", createdByUserId: "u1", createdAt: "2024-03-25", updatedAt: "2024-03-25" },
  { id: "c6", name: "Wayne Enterprises", location: "Toronto", country: "Canada", currencyId: "", kamUserId: "u2", createdByUserId: "u2", createdAt: "2024-04-05", updatedAt: "2024-04-05" },
  { id: "c7", name: "Oscorp", location: "Tokyo", country: "Japan", currencyId: "", kamUserId: "u4", createdByUserId: "u4", createdAt: "2024-04-18", updatedAt: "2024-04-18" },
  { id: "c8", name: "LexCorp", location: "Sydney", country: "Australia", currencyId: "", kamUserId: "u3", createdByUserId: "u3", createdAt: "2024-05-01", updatedAt: "2024-05-01" },
];

export const mockContacts: Contact[] = [
  { id: "ct1", name: "John Doe", companyId: "c1", designation: "CTO", mobile: "+1-555-1001", email: "john@acme.com", createdAt: "2024-01-20" },
  { id: "ct2", name: "Jane Roe", companyId: "c2", designation: "VP Sales", mobile: "+1-555-1002", email: "jane@globex.com", createdAt: "2024-02-05" },
  { id: "ct3", name: "Mike Chen", companyId: "c3", designation: "CFO", mobile: "+44-7700-1003", email: "mike@initech.com", createdAt: "2024-02-25" },
  { id: "ct4", name: "Sara Kim", companyId: "c4", designation: "Head of R&D", mobile: "+91-98765-1004", email: "sara@umbrella.com", createdAt: "2024-03-15" },
  { id: "ct5", name: "Tom Stark", companyId: "c5", designation: "CEO", mobile: "+49-170-1005", email: "tom@stark.com", createdAt: "2024-04-01" },
  { id: "ct6", name: "Lisa Park", companyId: "c1", designation: "Product Manager", mobile: "+1-555-1006", email: "lisa@acme.com", createdAt: "2024-04-10" },
  { id: "ct7", name: "Raj Patel", companyId: "c4", designation: null, mobile: "+91-98765-1007", email: null, createdAt: "2024-04-20" },
];

export const mockTasks: Task[] = [
  { id: "t1", title: "Follow up with Acme", note: "Discuss Q2 proposal", companyId: "c1", dueDatetime: "2025-03-15T10:00:00", assignByUserId: "u1", assignToUserId: "u2", status: "in_progress", createdAt: "2024-12-01" },
  { id: "t2", title: "Prepare Globex pitch deck", note: "Create slides", companyId: "c2", dueDatetime: "2025-03-20T14:00:00", assignByUserId: "u1", assignToUserId: "u3", status: "pending", createdAt: "2025-01-10" },
  { id: "t3", title: "Initech contract review", note: "Legal review", companyId: "c3", dueDatetime: "2025-02-28T09:00:00", assignByUserId: "u2", assignToUserId: "u2", status: "completed", createdAt: "2025-01-15" },
  { id: "t4", title: "Umbrella demo setup", note: null, companyId: "c4", dueDatetime: "2025-04-01T16:00:00", assignByUserId: "u1", assignToUserId: "u4", status: "pending", createdAt: "2025-02-01" },
  { id: "t5", title: "Stark integration call", note: "Technical discussion", companyId: "c5", dueDatetime: "2025-03-10T11:00:00", assignByUserId: "u3", assignToUserId: "u3", status: "in_progress", createdAt: "2025-02-10" },
];

export const mockSales: Sale[] = [
  { id: "s1", companyId: "c1", category: "hot", prospect: "Acme Enterprise License", expectedClosingDate: "2025-04-15", expectedRevenue: 75000, status: "negotiation", createdByUserId: "u2", createdAt: "2024-12-15" },
  { id: "s2", companyId: "c2", category: "warm", prospect: "Globex Cloud Migration", expectedClosingDate: "2025-05-01", expectedRevenue: 120000, status: "prospect", createdByUserId: "u3", createdAt: "2025-01-05" },
  { id: "s3", companyId: "c3", category: "hot", prospect: "Initech Security Suite", expectedClosingDate: "2025-03-01", expectedRevenue: 45000, status: "closed", createdByUserId: "u2", createdAt: "2025-01-20" },
  { id: "s4", companyId: "c4", category: "cold", prospect: "Umbrella Lab Platform", expectedClosingDate: "2025-06-15", expectedRevenue: 200000, status: "lead", createdByUserId: "u4", createdAt: "2025-02-01" },
  { id: "s5", companyId: "c5", category: "warm", prospect: "Stark AI Integration", expectedClosingDate: "2025-05-20", expectedRevenue: 350000, status: "prospect", createdByUserId: "u3", createdAt: "2025-02-15" },
  { id: "s6", companyId: "c1", category: "cold", prospect: "Acme Support Contract", expectedClosingDate: "2025-04-01", expectedRevenue: 25000, status: "disqualified", createdByUserId: "u2", createdAt: "2025-02-20" },
];

export const mockTaskLogs: TaskActivityLog[] = [
  { id: "tl1", taskId: "t1", actionType: "created", oldValue: null, newValue: { title: "Follow up with Acme" }, note: null, actorUserId: "u1", createdAt: "2024-12-01T10:00:00Z" },
  { id: "tl2", taskId: "t1", actionType: "status_changed", oldValue: { status: "pending" }, newValue: { status: "in_progress" }, note: "Started working on it", actorUserId: "u2", createdAt: "2025-01-05T14:30:00Z" },
  { id: "tl3", taskId: "t3", actionType: "status_changed", oldValue: { status: "in_progress" }, newValue: { status: "completed" }, note: "Contract approved", actorUserId: "u2", createdAt: "2025-02-25T09:15:00Z" },
];

export const mockSalesLogs: SalesStatusLog[] = [
  { id: "sl1", salesId: "s1", fromStatus: "lead", toStatus: "prospect", note: "Qualified after initial call", changedByUserId: "u2", changedAt: "2024-12-20T11:00:00Z" },
  { id: "sl2", salesId: "s1", fromStatus: "prospect", toStatus: "negotiation", note: "Proposal sent and accepted for review", changedByUserId: "u2", changedAt: "2025-01-10T16:00:00Z" },
  { id: "sl3", salesId: "s3", fromStatus: "negotiation", toStatus: "closed", note: "Contract signed", changedByUserId: "u2", changedAt: "2025-02-15T10:00:00Z" },
];

// Helper lookups
export const getUserName = (id: string) => mockUsers.find(u => u.id === id)?.name ?? "Unknown";
export const getCompanyName = (id: string) => mockCompanies.find(c => c.id === id)?.name ?? "Unknown";
export const getContactName = (id: string) => mockContacts.find(ct => ct.id === id)?.name ?? "Unknown";
export const getCompany = (id: string) => mockCompanies.find(c => c.id === id);
