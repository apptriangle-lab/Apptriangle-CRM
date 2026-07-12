/**
 * API client for the CRM backend.
 * Set VITE_API_URL in .env (e.g. http://localhost:5000 or SAME_ORIGIN for Docker/nginx).
 */
import { getApiBaseUrl } from "@/lib/apiBase";

const getBaseUrl = (): string => getApiBaseUrl();

export const getApiUrl = () => getBaseUrl();

/** Token stored after login (same key as AuthContext). Use for admin/user API calls. */
export function getStoredToken(): string | null {
  return localStorage.getItem("crm_token");
}

async function requestWithAuth<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request<T>(path, { ...options, headers });
}

export interface LoginResponse {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  };
  token: string;
  /** Null when session lasts until logout (no JWT expiry). */
  expiresAt: string | null;
}

export interface ApiError {
  error?: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers as Record<string, string>),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as ApiError).error ?? res.statusText ?? "Request failed";
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return data as T;
}

export interface LogoutResponse {
  ok: boolean;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: (token: string | null) =>
    request<LogoutResponse>("/api/auth/logout", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    requestWithAuth<{ ok: boolean }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  /** HR profile image (data URL) when present */
  profilePicture?: string | null;
}

export const usersApi = {
  list: () => requestWithAuth<UserDto[]>("/api/users"),
  get: (id: string) => requestWithAuth<UserDto>(`/api/users/${id}`),
  updateMe: (body: { name?: string; phone?: string }) =>
    requestWithAuth<UserDto>("/api/users/me", { method: "PATCH", body: JSON.stringify(body) }),
  create: (body: { name: string; email: string; password: string; phone?: string; role?: string }) =>
    requestWithAuth<UserDto>("/api/users", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; email?: string; phone?: string; role?: string; isActive?: boolean }) =>
    requestWithAuth<UserDto>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setPassword: (userId: string, newPassword: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/users/${userId}/password`, {
      method: "PUT",
      body: JSON.stringify({ newPassword }),
    }),
};

export type StatusConfigGroup =
  | "taskStatuses"
  | "pmsTaskStatuses"
  | "salesCategories"
  | "salesStatuses"
  | "orderStatuses"
  | "orderNextTodos";

export interface OrderStatusConfigItem {
  value: string;
  isActive: boolean;
}

export interface StatusConfigDto {
  taskStatuses: string[];
  pmsTaskStatuses: string[];
  salesCategories: string[];
  salesStatuses: string[];
  orderStatuses: OrderStatusConfigItem[];
  orderNextTodos: OrderStatusConfigItem[];
}

export type OrderConfigPatchGroup = "orderStatuses" | "orderNextTodos";

export const statusConfigApi = {
  get: () => request<StatusConfigDto>("/api/status-config"),
  add: (group: StatusConfigGroup, value: string) =>
    requestWithAuth<StatusConfigDto>("/api/status-config", {
      method: "POST",
      body: JSON.stringify({ group, value }),
    }),
  remove: (group: StatusConfigGroup, value: string) =>
    requestWithAuth<StatusConfigDto>("/api/status-config", {
      method: "DELETE",
      body: JSON.stringify({ group, value }),
    }),
  /** Admin: toggle active/inactive for order status or order next-to-do dropdowns. */
  patchOrderOptionActive: (group: OrderConfigPatchGroup, value: string, isActive: boolean) =>
    requestWithAuth<StatusConfigDto>("/api/status-config", {
      method: "PATCH",
      body: JSON.stringify({ group, value, isActive }),
    }),
};

export interface CompanyProfileDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  country: string;
  industry: string;
  taxId: string;
  description: string;
  logo: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const companyProfileApi = {
  get: () => requestWithAuth<CompanyProfileDto>("/api/company-profile"),
  update: (body: Partial<Omit<CompanyProfileDto, "id" | "createdAt" | "updatedAt">>) =>
    requestWithAuth<CompanyProfileDto>("/api/company-profile", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export interface CurrencyDto {
  id: string;
  code: string;
  name: string;
  symbol: string;
  sortOrder: number;
  createdAt: string | null;
}

export const currenciesApi = {
  list: () => requestWithAuth<CurrencyDto[]>("/api/currencies"),
  get: (id: string) => requestWithAuth<CurrencyDto>(`/api/currencies/${id}`),
  create: (body: { code: string; name: string; symbol?: string; sortOrder?: number }) =>
    requestWithAuth<CurrencyDto>("/api/currencies", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { code?: string; name?: string; symbol?: string; sortOrder?: number }) =>
    requestWithAuth<CurrencyDto>(`/api/currencies/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/currencies/${id}`, { method: "DELETE" }),
};

export interface ExpensePurposeDto {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | null;
}

export const expensePurposesApi = {
  list: () => requestWithAuth<ExpensePurposeDto[]>("/api/expense-purposes"),
  get: (id: string) => requestWithAuth<ExpensePurposeDto>(`/api/expense-purposes/${id}`),
  create: (body: { name: string; sortOrder?: number; isActive?: boolean }) =>
    requestWithAuth<ExpensePurposeDto>("/api/expense-purposes", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; sortOrder?: number; isActive?: boolean }) =>
    requestWithAuth<ExpensePurposeDto>(`/api/expense-purposes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/expense-purposes/${id}`, { method: "DELETE" }),
};

export interface ExpenseDto {
  id: string;
  companyId: string;
  date: string;
  amount: number;
  amountReturn: number | null;
  fromLocation: string;
  toLocation: string;
  purposeId: string;
  purposeName: string;
  purpose: string;
  tripType: string;
  createdByUserId: string;
  status: string;
  createdAt: string | null;
  /** Set when expense is soft-deleted (bin). Omitted or null when active. */
  deletedAt?: string | null;
}

export const expensesApi = {
  list: () => requestWithAuth<ExpenseDto[]>("/api/expenses"),
  /** Soft-deleted expenses for Settings → Bin (same visibility rules as list). */
  listBin: () => requestWithAuth<ExpenseDto[]>("/api/expenses/bin"),
  bulkSoftDelete: (ids: string[]) =>
    requestWithAuth<{ deletedIds: string[]; count: number }>("/api/expenses/bulk-soft-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  restore: (ids: string[]) =>
    requestWithAuth<{ restoredIds: string[]; count: number }>("/api/expenses/restore", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  get: (id: string) => requestWithAuth<ExpenseDto>(`/api/expenses/${id}`),
  create: (body: { companyId: string; date: string; amount: number; amountReturn?: number; fromLocation?: string; toLocation?: string; purposeId?: string | null; purpose?: string; tripType?: string; status?: string }) =>
    requestWithAuth<ExpenseDto>("/api/expenses", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { companyId?: string; date?: string; amount?: number; amountReturn?: number | null; fromLocation?: string; toLocation?: string; purposeId?: string | null; purpose?: string; tripType?: string; status?: string }) =>
    requestWithAuth<ExpenseDto>(`/api/expenses/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  /** Soft-delete one expense (same as bulk). */
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/expenses/${id}`, { method: "DELETE" }),
};

export interface AccountEntryDto {
  id: string;
  date: string;
  particular: string;
  description: string;
  voucherNo: string;
  amountDebit: number;
  amountCredit: number;
  /** Running balance after this row (server-computed on list API only). */
  balance?: number;
  paidBy: string;
  paidTo: string;
  hasAttachment: boolean;
  attachmentFileName: string | null;
  attachmentData?: string;
  createdAt: string | null;
  createdByUserId: string;
}

export interface AccountParticularDto {
  id: string;
  name: string;
  type: string;
  sortOrder: number;
  createdAt: string | null;
}

export const accountParticularsApi = {
  list: (params?: { type?: "received" | "expense" }) => {
    const sp = new URLSearchParams();
    if (params?.type) sp.set("type", params.type);
    const q = sp.toString();
    return requestWithAuth<AccountParticularDto[]>(`/api/account-particulars${q ? `?${q}` : ""}`);
  },
  get: (id: string) => requestWithAuth<AccountParticularDto>(`/api/account-particulars/${id}`),
  create: (body: { name: string; type: "received" | "expense"; sortOrder?: number }) =>
    requestWithAuth<AccountParticularDto>("/api/account-particulars", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; type?: string; sortOrder?: number }) =>
    requestWithAuth<AccountParticularDto>(`/api/account-particulars/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/account-particulars/${id}`, { method: "DELETE" }),
};

export const accountsApi = {
  list: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const q = sp.toString();
    return requestWithAuth<AccountEntryDto[]>(`/api/accounts${q ? `?${q}` : ""}`);
  },
  get: (id: string) => requestWithAuth<AccountEntryDto>(`/api/accounts/${id}`),
  create: (body: { date: string; particular?: string; description?: string; type: "received" | "expense"; amount: number; paidTo?: string; attachmentFileName?: string; attachmentData?: string }) =>
    requestWithAuth<AccountEntryDto>("/api/accounts", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { date?: string; particular?: string; description?: string; type?: "received" | "expense"; amount?: number; paidTo?: string; attachmentFileName?: string; attachmentData?: string | null }) =>
    requestWithAuth<AccountEntryDto>(`/api/accounts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/accounts/${id}`, { method: "DELETE" }),
};

export interface CompanyDto {
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

/** One row for POST /api/companies/bulk — use currencyId or currencyCode; kamUserId, kamEmail, or kamUserName. */
export type CompanyBulkItem = {
  name: string;
  location: string;
  country: string;
  currencyId?: string;
  currencyCode?: string;
  kamUserId?: string;
  kamEmail?: string;
  kamUserName?: string;
};

export type CompanyBulkResultRow =
  | { index: number; status: "created"; company: CompanyDto }
  | { index: number; status: "skipped"; reason: string; name?: string; country?: string }
  | { index: number; status: "error"; error: string };

export interface CompanyBulkResponse {
  summary: { created: number; skipped: number; errors: number };
  results: CompanyBulkResultRow[];
}

/** Response from POST /api/companies/bulk-upload (multipart Excel). */
export interface CompanyBulkUploadResponse extends CompanyBulkResponse {
  excel?: {
    fileName: string;
    rowsRead: number;
    currencyCode: string;
    currencyId: string;
  };
}

export const companiesApi = {
  list: (params?: { search?: string; country?: string; kamUserId?: string }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set("search", params.search);
    if (params?.country && params.country !== "all") sp.set("country", params.country);
    if (params?.kamUserId && params.kamUserId !== "all") sp.set("kamUserId", params.kamUserId);
    const q = sp.toString();
    return requestWithAuth<CompanyDto[]>(`/api/companies${q ? `?${q}` : ""}`);
  },
  get: (id: string) => requestWithAuth<CompanyDto>(`/api/companies/${id}`),
  create: (body: { name: string; location: string; country: string; currencyId: string; kamUserId: string }) =>
    requestWithAuth<CompanyDto>("/api/companies", { method: "POST", body: JSON.stringify(body) }),
  bulk: (body: { items: CompanyBulkItem[]; skipDuplicates?: boolean; stopOnError?: boolean }) =>
    requestWithAuth<CompanyBulkResponse>("/api/companies/bulk", { method: "POST", body: JSON.stringify(body) }),
  /** Upload .xlsx: columns Name, KeyAccountManager, Location, Country/County. Uses BDT from DB and resolves KAM by user name. */
  bulkUpload: (
    file: File,
    params?: { skipDuplicates?: boolean; stopOnError?: boolean; currencyCode?: string }
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    if (params?.skipDuplicates === false) fd.append("skipDuplicates", "false");
    if (params?.stopOnError) fd.append("stopOnError", "true");
    if (params?.currencyCode) fd.append("currencyCode", params.currencyCode);
    return requestWithAuth<CompanyBulkUploadResponse>("/api/companies/bulk-upload", {
      method: "POST",
      body: fd,
    });
  },
  update: (id: string, body: { name?: string; location?: string; country?: string; currencyId?: string; kamUserId?: string }) =>
    requestWithAuth<CompanyDto>(`/api/companies/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/companies/${id}`, { method: "DELETE" }),
};

export interface ContactDto {
  id: string;
  name: string;
  companyId: string;
  designation: string | null;
  mobile: string;
  email: string | null;
  /** Set for RBAC; empty for legacy rows. */
  createdByUserId?: string;
  createdAt: string;
}

export const contactsApi = {
  list: (params?: { companyId?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.companyId) sp.set("companyId", params.companyId);
    if (params?.search) sp.set("search", params.search);
    const q = sp.toString();
    return requestWithAuth<ContactDto[]>(`/api/contacts${q ? `?${q}` : ""}`);
  },
  get: (id: string) => requestWithAuth<ContactDto>(`/api/contacts/${id}`),
  create: (body: { name: string; companyId: string; designation?: string; mobile: string; email?: string }) =>
    requestWithAuth<ContactDto>("/api/contacts", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; companyId?: string; designation?: string; mobile?: string; email?: string }) =>
    requestWithAuth<ContactDto>(`/api/contacts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/contacts/${id}`, { method: "DELETE" }),
};

export interface TaskDto {
  id: string;
  title: string;
  note: string | null;
  companyId: string;
  dueDatetime: string;
  assignByUserId: string;
  assignToUserId: string;
  status: string;
  createdAt: string;
}

export interface TaskActivityLogDto {
  id: string;
  taskId: string;
  actionType: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  note: string | null;
  actorUserId: string;
  createdAt: string;
}

export const tasksApi = {
  list: (params?: { status?: string; companyId?: string; assignToUserId?: string; assignByUserId?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.companyId) sp.set("companyId", params.companyId);
    if (params?.assignToUserId) sp.set("assignToUserId", params.assignToUserId);
    if (params?.assignByUserId) sp.set("assignByUserId", params.assignByUserId);
    if (params?.search) sp.set("search", params.search);
    const q = sp.toString();
    return requestWithAuth<TaskDto[]>(`/api/tasks${q ? `?${q}` : ""}`);
  },
  get: (id: string) => requestWithAuth<TaskDto>(`/api/tasks/${id}`),
  create: (body: {
    title: string;
    note?: string | null;
    companyId: string;
    dueDatetime: string;
    assignByUserId?: string;
    assignToUserId?: string;
  }) =>
    requestWithAuth<TaskDto>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: {
    title?: string;
    note?: string | null;
    companyId?: string;
    dueDatetime?: string;
    assignByUserId?: string;
    assignToUserId?: string;
    actorUserId?: string;
  }) =>
    requestWithAuth<TaskDto>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  patchStatus: (id: string, body: { status: string; actorUserId?: string; note?: string }) =>
    requestWithAuth<TaskDto>(`/api/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),
  logs: (id: string) => requestWithAuth<TaskActivityLogDto[]>(`/api/tasks/${id}/logs`),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/tasks/${id}`, { method: "DELETE" }),
};

export interface SaleDto {
  id: string;
  companyId: string;
  category: string;
  prospect: string;
  expectedClosingDate: string;
  expectedRevenue: number;
  status: string;
  nextAction?: string;
  nextActionDate?: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface SalesStatusLogDto {
  id: string;
  salesId: string;
  fromStatus: string;
  toStatus: string;
  note: string;
  changedByUserId: string;
  changedAt: string;
}

export interface SalesActivityDto {
  id: string;
  salesId: string;
  title: string;
  note: string;
  date: string;
  createdByUserId: string;
  createdAt: string;
}

export const salesApi = {
  list: (params?: { status?: string; companyId?: string; category?: string; createdByUserId?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.companyId) sp.set("companyId", params.companyId);
    if (params?.category) sp.set("category", params.category);
    if (params?.createdByUserId) sp.set("createdByUserId", params.createdByUserId);
    if (params?.search) sp.set("search", params.search);
    const q = sp.toString();
    return requestWithAuth<SaleDto[]>(`/api/sales${q ? `?${q}` : ""}`);
  },
  get: (id: string) => requestWithAuth<SaleDto>(`/api/sales/${id}`),
  create: (body: {
    prospect: string;
    companyId: string;
    category?: string;
    expectedClosingDate: string;
    expectedRevenue?: number;
    status?: string;
    nextAction?: string;
    nextActionDate?: string | null;
    createdByUserId?: string;
  }) =>
    requestWithAuth<SaleDto>("/api/sales", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: {
    prospect?: string;
    companyId?: string;
    category?: string;
    expectedClosingDate?: string;
    expectedRevenue?: number;
    nextAction?: string;
    nextActionDate?: string | null;
  }) =>
    requestWithAuth<SaleDto>(`/api/sales/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  patchStatus: (id: string, body: { status: string; changedByUserId?: string; note?: string }) =>
    requestWithAuth<SaleDto>(`/api/sales/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),
  logs: (id: string) => requestWithAuth<SalesStatusLogDto[]>(`/api/sales/${id}/logs`),
  activities: {
    list: (saleId: string) => requestWithAuth<SalesActivityDto[]>(`/api/sales/${saleId}/activities`),
    create: (saleId: string, body: { title: string; note?: string; date: string; createdByUserId?: string }) =>
      requestWithAuth<SalesActivityDto>(`/api/sales/${saleId}/activities`, { method: "POST", body: JSON.stringify(body) }),
    update: (saleId: string, activityId: string, body: { title?: string; note?: string; date?: string }) =>
      requestWithAuth<SalesActivityDto>(`/api/sales/${saleId}/activities/${activityId}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (saleId: string, activityId: string) =>
      requestWithAuth<{ ok: boolean }>(`/api/sales/${saleId}/activities/${activityId}`, { method: "DELETE" }),
  },
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/sales/${id}`, { method: "DELETE" }),
};

export interface OrderAttachmentDto {
  fileName: string;
  data: string;
}

export interface OrderDto {
  id: string;
  companyId: string;
  salesId: string;
  orderDetails: string;
  revenue: number;
  orderConfirmationDate: string;
  deliveryDate: string;
  assignTo: string;
  forwardedTo: string;
  attachments: OrderAttachmentDto[];
  status: string;
  nextAction: string;
  nextActionDate: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** Plain order create, or order + sale update when closing won on the deal. */
export type CreateOrderResponse = OrderDto | { order: OrderDto; sale: SaleDto };

export type OrdersListParams = {
  companyId?: string;
  salesId?: string;
  /** Admin only */
  assignToUserId?: string;
  /** Admin only */
  status?: string;
  /** Admin only — ISO date (yyyy-MM-dd) */
  nextActionDateFrom?: string;
  nextActionDateTo?: string;
  /** Non-admin — exact next-action value, or `__none__` for empty */
  nextAction?: string;
  /** Non-admin — ISO date */
  deliveryDateFrom?: string;
  deliveryDateTo?: string;
};

export const ordersApi = {
  list: (params?: OrdersListParams) => {
    const sp = new URLSearchParams();
    if (params?.companyId) sp.set("companyId", params.companyId);
    if (params?.salesId) sp.set("salesId", params.salesId);
    if (params?.assignToUserId) sp.set("assignToUserId", params.assignToUserId);
    if (params?.status) sp.set("status", params.status);
    if (params?.nextActionDateFrom) sp.set("nextActionDateFrom", params.nextActionDateFrom);
    if (params?.nextActionDateTo) sp.set("nextActionDateTo", params.nextActionDateTo);
    if (params?.nextAction) sp.set("nextAction", params.nextAction);
    if (params?.deliveryDateFrom) sp.set("deliveryDateFrom", params.deliveryDateFrom);
    if (params?.deliveryDateTo) sp.set("deliveryDateTo", params.deliveryDateTo);
    const q = sp.toString();
    return requestWithAuth<OrderDto[]>(`/api/orders${q ? `?${q}` : ""}`);
  },
  patch: (
    id: string,
    body: { status?: string; nextAction?: string; nextActionDate?: string | null; forwardedTo?: string | null },
  ) => requestWithAuth<OrderDto>(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  create: (body: {
    companyId: string;
    salesId: string;
    orderDetails: string;
    revenue: number;
    orderConfirmationDate: string;
    deliveryDate: string;
    assignTo: string;
    attachments?: OrderAttachmentDto[];
    createdByUserId?: string;
    finalizeCloseWon?: boolean;
    closedWonStatus?: string;
    statusChangeNote?: string;
    changedByUserId?: string;
  }) =>
    requestWithAuth<CreateOrderResponse>("/api/orders", { method: "POST", body: JSON.stringify(body) }),
};

export interface RenewalDto {
  id: string;
  companyId: string;
  kamUserId: string;
  productDetails: string;
  renewalType: "existing" | "potential";
  source: string;
  renewalDate: string;
  companyLocation: string;
  createdByUserId: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const renewalsApi = {
  list: (params?: { companyId?: string; kamUserId?: string; source?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.companyId) sp.set("companyId", params.companyId);
    if (params?.kamUserId) sp.set("kamUserId", params.kamUserId);
    if (params?.source) sp.set("source", params.source);
    if (params?.search) sp.set("search", params.search);
    const q = sp.toString();
    return requestWithAuth<RenewalDto[]>(`/api/renewals${q ? `?${q}` : ""}`);
  },
  listBin: () => requestWithAuth<RenewalDto[]>("/api/renewals/bin"),
  get: (id: string) => requestWithAuth<RenewalDto>(`/api/renewals/${id}`),
  create: (body: { companyId: string; productDetails: string; renewalType: "existing" | "potential"; source: string; renewalDate: string; createdByUserId?: string }) =>
    requestWithAuth<RenewalDto>("/api/renewals", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { companyId: string; productDetails: string; renewalType: "existing" | "potential"; source: string; renewalDate: string }) =>
    requestWithAuth<RenewalDto>(`/api/renewals/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  restore: (ids: string[]) =>
    requestWithAuth<{ restoredIds: string[]; count: number }>("/api/renewals/restore", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/renewals/${id}`, { method: "DELETE" }),
};

export interface HRInfoDto {
  id: string;
  userId: string;
  birthDate?: string;
  nid?: string;
  department?: string;
  designation?: string;
  religion?: string;
  bloodGroup?: string;
  officeMail?: string;
  personalMail?: string;
  maritalStatus?: string;
  gender?: string;
  employeeType?: string;
  joiningDate?: string;
  reportingManagerId?: string;
  presentAddress?: string;
  permanentAddress?: string;
  name?: string;
  mobile?: string;
  employeeId?: string;
  shiftId?: string;
  profilePicture?: string;
  bankRoutingNumber?: string;
  beneficiaryBankAccountNumber?: string;
  receiverName?: string;
  emergencyContacts?: EmergencyContactDto[];
  employmentHistory?: EmploymentHistoryDto[];
  academicCertifications?: AcademicCertificationDto[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EmploymentHistoryDto {
  id: string;
  hrInfoId: string;
  activity?: string;
  appraisalDate?: string;
  nextActivity?: string;
  nextActivityDate?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Minimal HR fields returned by list/lookup endpoints (no blobs or nested arrays). */
export interface HREmployeeSummaryDto {
  id: string;
  userId: string;
  department?: string;
  designation?: string;
  employeeType?: string;
  joiningDate?: string | null;
  reportingManagerId?: string;
  reportingManagerName?: string;
  shiftId?: string;
  employeeId?: string;
}

export interface HREmployeeLatestEmploymentDto {
  nextActivity?: string;
  nextActivityDate?: string;
  appraisalDate?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

export interface HREmployeeListItemDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  hr: HREmployeeSummaryDto | null;
  latestEmployment: HREmployeeLatestEmploymentDto | null;
}

export interface HREmployeeListResponseDto {
  items: HREmployeeListItemDto[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface HREmployeeLookupItemDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  profilePicture: string | null;
  hr: HREmployeeSummaryDto | null;
}

export type HREmployeeListParams = {
  page?: number;
  perPage?: number;
  search?: string;
  department?: string;
  designation?: string;
  role?: string;
};

export interface AcademicCertificationDto {
  id: string;
  hrInfoId: string;
  degree?: string;
  institute?: string;
  grade?: string;
  year?: string;
  attachmentFileName?: string;
  attachmentData?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmergencyContactDto {
  id: string;
  hrInfoId: string;
  name?: string;
  phone?: string;
  relation?: string;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LateReconciliationHintDto {
  canSubmit: boolean;
  attendanceId: string;
  pendingRequestId: string | null;
}

export interface AttendanceDto {
  id: string | null;
  userId: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInLocation: string | null;
  checkOutLocation: string | null;
  status: string;
  /** When false, check-in/out are blocked until admin assigns a shift (HR). */
  hasShiftAssigned?: boolean;
  isWeekend?: boolean;
  isHoliday?: boolean;
  /** Present when status is late: whether user may submit a reconciliation request. */
  lateReconciliation?: LateReconciliationHintDto | null;
  /** True when a late record was marked present via an approved reconciliation (audit id below). */
  reconciliationApproved?: boolean;
  reconciliationRequestId?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type AttendanceReconciliationStatus = "pending" | "approved" | "rejected";

export interface AttendanceReconciliationDto {
  id: string;
  attendanceId: string;
  userId: string;
  attendanceDate: string;
  requestedCheckInTime: string;
  reason: string;
  applicantNote: string;
  status: AttendanceReconciliationStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  createdAt: string | null;
  updatedAt: string | null;
  requesterName: string;
  requesterEmail: string;
  reviewedByName: string | null;
}

export const attendanceApi = {
  getToday: async (): Promise<AttendanceDto> => {
    return requestWithAuth<AttendanceDto>("/api/attendance/today");
  },
  checkIn: async (location: string): Promise<AttendanceDto> => {
    return requestWithAuth<AttendanceDto>("/api/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({ location }),
      headers: { "Content-Type": "application/json" },
    });
  },
  checkOut: async (location: string): Promise<AttendanceDto> => {
    return requestWithAuth<AttendanceDto>("/api/attendance/check-out", { 
      method: "POST",
      body: JSON.stringify({ location }),
      headers: { "Content-Type": "application/json" },
    });
  },
  getRecords: async (period: "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "year" | "last_year" = "today"): Promise<AttendanceDto[]> => {
    return requestWithAuth<AttendanceDto[]>(`/api/attendance/records?period=${period}`);
  },
  getAll: async (period: "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "year" | "last_year" = "today", userId?: string): Promise<AttendanceDto[]> => {
    const url = userId 
      ? `/api/attendance/all?period=${period}&userId=${userId}`
      : `/api/attendance/all?period=${period}`;
    return requestWithAuth<AttendanceDto[]>(url);
  },
};

export type AttendanceReconciliationListParams = {
  status?: AttendanceReconciliationStatus;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export const attendanceReconciliationApi = {
  list: async (
    params?: AttendanceReconciliationListParams,
  ): Promise<AttendanceReconciliationDto[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.userId) q.set("userId", params.userId);
    if (params?.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params?.dateTo) q.set("dateTo", params.dateTo);
    const qs = q.toString();
    return requestWithAuth<AttendanceReconciliationDto[]>(
      `/api/attendance/reconciliations${qs ? `?${qs}` : ""}`,
    );
  },
  create: async (body: { attendanceId: string; reason: string }): Promise<AttendanceReconciliationDto> => {
    return requestWithAuth<AttendanceReconciliationDto>("/api/attendance/reconciliations", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  },
  review: async (
    id: string,
    body: { status: "approved" | "rejected"; reviewNote?: string },
  ): Promise<AttendanceReconciliationDto> => {
    return requestWithAuth<AttendanceReconciliationDto>(`/api/attendance/reconciliations/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  },
};

export const hrApi = {
  listEmployees: (params?: HREmployeeListParams) => {
    const sp = new URLSearchParams();
    if (params?.page != null) sp.set("page", String(params.page));
    if (params?.perPage != null) sp.set("perPage", String(params.perPage));
    if (params?.search) sp.set("search", params.search);
    if (params?.department) sp.set("department", params.department);
    if (params?.designation) sp.set("designation", params.designation);
    if (params?.role) sp.set("role", params.role);
    const qs = sp.toString();
    return requestWithAuth<HREmployeeListResponseDto>(
      `/api/hr/employees${qs ? `?${qs}` : ""}`,
    );
  },
  lookupEmployees: () =>
    requestWithAuth<HREmployeeLookupItemDto[]>("/api/hr/employees/lookup"),
  get: (userId: string) => requestWithAuth<HRInfoDto>(`/api/hr/info/${userId}`),
  update: (userId: string, body: Partial<HRInfoDto>) =>
    requestWithAuth<HRInfoDto>(`/api/hr/info/${userId}`, { method: "PUT", body: JSON.stringify(body) }),
  createEmploymentHistory: (body: { hrInfoId: string; activity?: string; appraisalDate?: string; nextActivity?: string; nextActivityDate?: string; remarks?: string }) =>
    requestWithAuth<EmploymentHistoryDto>("/api/hr/employment-history", { method: "POST", body: JSON.stringify(body) }),
  updateEmploymentHistory: (entryId: string, body: { activity?: string; appraisalDate?: string; nextActivity?: string; nextActivityDate?: string; remarks?: string }) =>
    requestWithAuth<EmploymentHistoryDto>(`/api/hr/employment-history/${entryId}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteEmploymentHistory: (entryId: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/hr/employment-history/${entryId}`, { method: "DELETE" }),
  createAcademicCertification: (body: { hrInfoId: string; degree?: string; institute?: string; grade?: string; year?: string; attachmentFileName?: string; attachmentData?: string }) =>
    requestWithAuth<AcademicCertificationDto>("/api/hr/academic-certification", { method: "POST", body: JSON.stringify(body) }),
  updateAcademicCertification: (entryId: string, body: { degree?: string; institute?: string; grade?: string; year?: string; attachmentFileName?: string; attachmentData?: string }) =>
    requestWithAuth<AcademicCertificationDto>(`/api/hr/academic-certification/${entryId}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteAcademicCertification: (entryId: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/hr/academic-certification/${entryId}`, { method: "DELETE" }),
  createEmergencyContact: (body: { hrInfoId: string; name?: string; phone?: string; relation?: string; address?: string }) =>
    requestWithAuth<EmergencyContactDto>("/api/hr/emergency-contact", { method: "POST", body: JSON.stringify(body) }),
  updateEmergencyContact: (entryId: string, body: { name?: string; phone?: string; relation?: string; address?: string }) =>
    requestWithAuth<EmergencyContactDto>(`/api/hr/emergency-contact/${entryId}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteEmergencyContact: (entryId: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/hr/emergency-contact/${entryId}`, { method: "DELETE" }),
};

export interface DepartmentDto {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface DesignationDto {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface EmployeeTypeDto {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | null;
}

export const departmentsApi = {
  list: () => requestWithAuth<DepartmentDto[]>("/api/departments"),
  create: (body: { name: string }) =>
    requestWithAuth<DepartmentDto>("/api/departments", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; isActive?: boolean }) =>
    requestWithAuth<DepartmentDto>(`/api/departments/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/departments/${id}`, { method: "DELETE" }),
};

export const designationsApi = {
  list: () => requestWithAuth<DesignationDto[]>("/api/designations"),
  create: (body: { name: string }) =>
    requestWithAuth<DesignationDto>("/api/designations", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; isActive?: boolean }) =>
    requestWithAuth<DesignationDto>(`/api/designations/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/designations/${id}`, { method: "DELETE" }),
};

export const employeeTypesApi = {
  list: () => requestWithAuth<EmployeeTypeDto[]>("/api/employee-types"),
  create: (body: { name: string }) =>
    requestWithAuth<EmployeeTypeDto>("/api/employee-types", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; isActive?: boolean }) =>
    requestWithAuth<EmployeeTypeDto>(`/api/employee-types/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/employee-types/${id}`, { method: "DELETE" }),
};

export interface HolidayDto {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  durationDays?: number;
  /** Same as startDate when API returns legacy fields */
  date?: string;
  createdAt: string;
}

export interface LeaveTypeDto {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string | null;
}

export interface EmployeeLeaveBalanceRowDto {
  leaveTypeId: string;
  leaveTypeName: string;
  isActive: boolean;
  /** HR-assigned credited days for this leave type. */
  balance: number;
  /**
   * Days still available without counting as additional leave, after credited
   * balance offsets prior additional usage (same as server apply logic).
   */
  remainingBalance?: number;
  /** Uncovered additional leave (approved only) after offset by credit; pending is excluded. */
  additionalOutstanding?: number;
}

export interface EmployeeLeaveBalanceDto {
  userId: string;
  balances: EmployeeLeaveBalanceRowDto[];
}

/** How the leave spans time; drives validation and stored day count. */
export type LeaveDurationType = "single_day" | "half_day" | "multiple_day";

/** Which session for a half-day leave (morning vs afternoon). */
export type HalfDayPeriod = "first_half" | "second_half";

export interface LeaveDto {
  id: string;
  userId: string;
  userName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  durationType?: LeaveDurationType;
  /** Stored entitlement: 1, 0.5, or working-days total for multi-day. */
  totalLeaveDays?: number;
  /** Days beyond remaining quota for this request (additional leave). */
  additionalLeaveDays?: number;
  /** Set when durationType is half_day. */
  halfDayPeriod?: HalfDayPeriod | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  attachmentFileName: string | null;
  attachmentData?: string;
  approvedByUserId: string;
  approvedByName: string;
  rejectionReason: string;
  createdAt: string | null;
  updatedAt: string | null;
  workingDays?: number; // Mirrors totalLeaveDays when present; else calculated
}

export type LeaveApplyBody = {
  leaveTypeId: string;
  durationType: LeaveDurationType;
  startDate: string;
  endDate: string;
  reason: string;
  halfDayPeriod?: HalfDayPeriod | null;
  attachmentFileName?: string;
  attachmentData?: string;
};

export const leavesApi = {
  getTypes: () => requestWithAuth<LeaveTypeDto[]>("/api/leaves/types"),
  getAllTypes: () => requestWithAuth<LeaveTypeDto[]>("/api/leaves/types/all"),
  getEmployeeBalances: (userId: string) =>
    requestWithAuth<EmployeeLeaveBalanceDto>(`/api/leaves/balances/${userId}`),
  updateEmployeeBalances: (
    userId: string,
    balances: Array<{ leaveTypeId: string; balance: number }>,
  ) =>
    requestWithAuth<EmployeeLeaveBalanceDto>(`/api/leaves/balances/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ balances }),
    }),
  createType: (body: { name: string }) =>
    requestWithAuth<LeaveTypeDto>("/api/leaves/types", { method: "POST", body: JSON.stringify(body) }),
  updateType: (typeId: string, body: { name: string; isActive?: boolean }) =>
    requestWithAuth<LeaveTypeDto>(`/api/leaves/types/${typeId}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteType: (typeId: string) =>
    requestWithAuth<{ message: string }>(`/api/leaves/types/${typeId}`, { method: "DELETE" }),
  apply: (body: LeaveApplyBody) =>
    requestWithAuth<LeaveDto>("/api/leaves/apply", { method: "POST", body: JSON.stringify(body) }),
  getMy: () => requestWithAuth<LeaveDto[]>("/api/leaves/my"),
  getAll: (params?: {
    startDate?: string;
    endDate?: string;
    userIds?: string[];
  }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set("startDate", params.startDate);
    if (params?.endDate) sp.set("endDate", params.endDate);
    if (params?.userIds?.length) sp.set("userIds", params.userIds.join(","));
    const q = sp.toString();
    return requestWithAuth<LeaveDto[]>(`/api/leaves/all${q ? `?${q}` : ""}`);
  },
  getTeam: () => requestWithAuth<LeaveDto[]>("/api/leaves/team"),
  isReportingManager: () => requestWithAuth<{ isReportingManager: boolean; teamSize: number }>("/api/leaves/is-reporting-manager"),
  approve: (leaveId: string) =>
    requestWithAuth<LeaveDto>(`/api/leaves/${leaveId}/approve`, { method: "POST" }),
  reject: (leaveId: string, reason: string) =>
    requestWithAuth<LeaveDto>(`/api/leaves/${leaveId}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  getDetails: (leaveId: string) => requestWithAuth<LeaveDto>(`/api/leaves/${leaveId}`),
  update: (leaveId: string, body: LeaveApplyBody) =>
    requestWithAuth<LeaveDto>(`/api/leaves/${leaveId}`, { method: "PUT", body: JSON.stringify(body) }),
  calculateDays: (startDate: string, endDate: string, userId?: string) =>
    requestWithAuth<{ workingDays: number }>("/api/leaves/calculate-days", {
      method: "POST",
      body: JSON.stringify({
        startDate,
        endDate,
        ...(userId ? { userId } : {}),
      }),
    }),
  // Weekends
  getWeekends: () => requestWithAuth<Array<{ id: string; dayOfWeek: number; dayName: string; createdAt: string }>>("/api/leaves/weekends"),
  createWeekend: (dayOfWeek: number) =>
    requestWithAuth<{ id: string; dayOfWeek: number; dayName: string; createdAt: string }>("/api/leaves/weekends", {
      method: "POST",
      body: JSON.stringify({ dayOfWeek }),
    }),
  deleteWeekend: (weekendId: string) =>
    requestWithAuth<{ message: string }>(`/api/leaves/weekends/${weekendId}`, { method: "DELETE" }),
  // Holidays (inclusive date range; single-day = same startDate and endDate)
  getHolidays: () => requestWithAuth<HolidayDto[]>("/api/leaves/holidays"),
  createHoliday: (name: string, startDate: string, endDate: string) =>
    requestWithAuth<HolidayDto>("/api/leaves/holidays", {
      method: "POST",
      body: JSON.stringify({ name, startDate, endDate }),
    }),
  updateHoliday: (
    holidayId: string,
    body: { name?: string; startDate?: string; endDate?: string; date?: string },
  ) =>
    requestWithAuth<HolidayDto>(`/api/leaves/holidays/${holidayId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteHoliday: (holidayId: string) =>
    requestWithAuth<{ message: string }>(`/api/leaves/holidays/${holidayId}`, { method: "DELETE" }),
};

export interface ShiftDto {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  weekendDays: number[];
  gracePeriod: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export const shiftsApi = {
  list: () => requestWithAuth<ShiftDto[]>("/api/shifts"),
  create: (body: { name: string; startTime: string; endTime: string; weekendDays: number[]; gracePeriod?: number; employeeIds?: string[] }) =>
    requestWithAuth<ShiftDto>("/api/shifts", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; startTime?: string; endTime?: string; weekendDays?: number[]; gracePeriod?: number; employeeIds?: string[] }) =>
    requestWithAuth<ShiftDto>(`/api/shifts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) =>
    requestWithAuth<{ message: string }>(`/api/shifts/${id}`, { method: "DELETE" }),
  assign: (userId: string, shiftId: string | null) =>
    requestWithAuth<{ message: string }>("/api/shifts/assign", { method: "POST", body: JSON.stringify({ userId, shiftId }) }),
};

export interface NotificationDto {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  category?: "task" | "pms" | "hr" | "system";
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set("limit", params.limit.toString());
    if (params?.offset) sp.set("offset", params.offset.toString());
    const q = sp.toString();
    return requestWithAuth<{ notifications: NotificationDto[]; unreadCount: number }>(`/api/notifications${q ? `?${q}` : ""}`);
  },
  markAsRead: (id: string) =>
    requestWithAuth<{ message: string }>(`/api/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () =>
    requestWithAuth<{ message: string }>("/api/notifications/read-all", { method: "PATCH" }),
  delete: (id: string) =>
    requestWithAuth<{ message: string }>(`/api/notifications/${id}`, { method: "DELETE" }),
};

/** One recipient in the credentials table “Shared” stack */
export interface CredentialSharePreviewDto {
  name: string;
  profilePicture?: string | null;
}

/** Encrypted credential vault; secrets masked unless ?reveal=true (server checks permission). */
export interface CredentialSummaryDto {
  id: string;
  title: string;
  usernameMasked?: string;
  /** First two characters + bullets when username length > 2 (table/list hint). */
  usernameMaskedDisplay?: string;
  passwordMasked?: string;
  /** Plaintext only when detail fetched with reveal=true */
  username?: string | null;
  url?: string;
  note?: string;
  /** @deprecated migrated to note */
  description?: string;
  tags?: string[];
  ownerId: string;
  ownerName?: string;
  /** Login email of the credential owner (list + detail). */
  ownerEmail?: string;
  /** HR profile image data URL when set. */
  ownerProfilePicture?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  accessLevel?: string;
  sharesCount?: number;
  /** Active share recipients — names + optional HR profile image (data URL) for avatar stack */
  sharePreview?: CredentialSharePreviewDto[];
  hasExpiredShares?: boolean;
  ownerWarningMessage?: string | null;
  myShareExpiresAt?: string | null;
  isShareActive?: boolean;
  isExpired?: boolean;
  /** True when this share has no expiry (forever access) */
  shareNeverExpires?: boolean;
}

export interface CredentialDetailDto extends CredentialSummaryDto {
  password?: string | null;
}

export interface CredentialShareDto {
  id: string;
  sharedWith: { id: string; name: string; email: string };
  sharedBy: { id: string; name: string };
  expiryDatetime: string | null;
  /** True when no expiry was set (access does not end) */
  shareNeverExpires?: boolean;
  isExpired: boolean;
  createdAt: string | null;
}

export interface CredentialAuditEntryDto {
  id: string;
  user: { id: string; name: string; email: string };
  action: string;
  createdAt: string | null;
}

/** Soft-deleted row in Settings → Bin → Credentials (credentials admin only). */
export interface CredentialBinRowDto {
  id: string;
  title: string;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  deletedAt: string | null;
}

function credentialsQuery(params?: { q?: string }) {
  const sp = new URLSearchParams();
  if (params?.q?.trim()) sp.set("q", params.q.trim());
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export const credentialsApi = {
  listMine: (params?: { q?: string }) =>
    requestWithAuth<CredentialSummaryDto[]>(`/api/credentials/mine${credentialsQuery(params)}`),
  listSharedWithMe: (params?: { q?: string }) =>
    requestWithAuth<CredentialSummaryDto[]>(`/api/credentials/shared-with-me${credentialsQuery(params)}`),
  listAll: (params?: { q?: string }) =>
    requestWithAuth<CredentialSummaryDto[]>(`/api/credentials/all${credentialsQuery(params)}`),
  get: (id: string, reveal?: boolean) =>
    requestWithAuth<CredentialDetailDto>(
      `/api/credentials/${encodeURIComponent(id)}${reveal ? "?reveal=true" : ""}`,
    ),
  create: (body: {
    title: string;
    username?: string;
    password: string;
    url?: string;
    note?: string;
  }) =>
    requestWithAuth<CredentialDetailDto>("/api/credentials", { method: "POST", body: JSON.stringify(body) }),
  update: (
    id: string,
    body: Partial<{ title: string; username: string; password: string; url: string; note: string }>,
  ) =>
    requestWithAuth<CredentialDetailDto>(`/api/credentials/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/credentials/${encodeURIComponent(id)}`, { method: "DELETE" }),
  listBin: () => requestWithAuth<CredentialBinRowDto[]>("/api/credentials/bin"),
  restore: (ids: string[]) =>
    requestWithAuth<{ restoredIds: string[]; count: number }>("/api/credentials/restore", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  listShares: (id: string) =>
    requestWithAuth<{ shares: CredentialShareDto[] }>(`/api/credentials/${encodeURIComponent(id)}/shares`),
  addShares: (
    id: string,
    body: {
      userIds: string[];
      /** Omit or leave empty for access forever */
      expiryDatetime?: string;
      includeGlobalAdmins?: boolean;
      includeCredentialAdmins?: boolean;
    },
  ) =>
    requestWithAuth<{ shares: CredentialShareDto[] }>(`/api/credentials/${encodeURIComponent(id)}/shares`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  revokeShare: (credentialId: string, shareId: string) =>
    requestWithAuth<{ ok: boolean }>(
      `/api/credentials/${encodeURIComponent(credentialId)}/shares/${encodeURIComponent(shareId)}`,
      { method: "DELETE" },
    ),
  listAudit: (id: string, limit?: number) =>
    requestWithAuth<{ entries: CredentialAuditEntryDto[] }>(
      `/api/credentials/${encodeURIComponent(id)}/audit${limit ? `?limit=${limit}` : ""}`,
    ),
};

/** RFQ — Request for Quotation */
export type RfqStatus =
  | "draft"
  | "pending_rbac"
  | "pending_system"
  | "reapplied"
  | "approved"
  | "rejected";

export interface RfqItemDto {
  id: string;
  lineNo: number;
  description: string;
  quantity: number;
  unitBuyingPrice: number | null;
  profitPerUnit: number | null;
  unitSellingPrice: number | null;
  totalProfit: number | null;
  lineNote: string;
  /** VAT % on this line’s extended amount (qty × unit selling). Null uses RFQ-level `vatPercent` on the server. */
  vatPercent?: number | null;
}

export interface RfqSummaryDto {
  id: string;
  salesId: string;
  companyId: string;
  status: RfqStatus;
  notesOverall: string;
  rejectionReason: string;
  createdByUserId: string;
  createdBy: { id: string; name: string; email: string };
  pricingAssigneeUserId: string;
  pricingAssignee: { id: string; name: string; email: string; profilePicture?: string };
  submittedAt: string | null;
  pricingSubmittedAt: string | null;
  resolvedAt: string | null;
  approvedByUserId: string;
  rejectedByUserId: string;
  createdAt: string | null;
  updatedAt: string | null;
  deal?: { id: string; prospect: string; status: string } | null;
  customer: { id: string; name: string };
  /** VAT as % of subtotal (e.g. 5 = 5%). Set by pricing admin; omitted/null uses UI default. */
  vatPercent?: number | null;
  /** Active iteration (increments on each reopen after approval). */
  versionNumber?: number;
}

export interface RfqDetailDto extends RfqSummaryDto {
  items: RfqItemDto[];
}

export interface RfqHistoryInvoiceDto {
  items: RfqItemDto[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  vatPercent: number | null;
}

export interface RfqHistoryVersionDto {
  versionNumber: number;
  pricing: RfqItemDto[];
  vatPercent: number | null;
  invoice: RfqHistoryInvoiceDto | null;
  approvedBy: { id: string; name: string; email: string };
  approvedAt: string | null;
  archivedAt: string | null;
  archivedBy: { id: string; name: string; email: string };
}

export interface RfqHistoryResponseDto {
  currentVersion: number;
  versions: RfqHistoryVersionDto[];
}

export interface RfqDealOption {
  salesId: string;
  prospect: string;
  companyId: string;
  companyName: string;
  /** True when another RFQ already uses this deal (not the RFQ passed as `excludeRfqId` on search). */
  hasExistingRfq?: boolean;
  existingRfqId?: string | null;
}

/** Users with RFQ module Admin in RBAC (UserPagePermission rfq + admin). */
export interface RfqRbacAdminOption {
  id: string;
  name: string;
  email: string;
  /** HR profile image (data URL) when set */
  profilePicture?: string;
}

export const rfqApi = {
  /** When `salesId` is set, returns 0–1 deal for prefill (e.g. from sales details). `excludeRfqId` marks the current RFQ when editing so its deal stays selectable. */
  searchDeals: (q?: string, salesId?: string, excludeRfqId?: string) => {
    const sp = new URLSearchParams();
    if (q?.trim()) sp.set("q", q.trim());
    if (salesId?.trim()) sp.set("salesId", salesId.trim());
    if (excludeRfqId?.trim()) sp.set("excludeRfqId", excludeRfqId.trim());
    const qs = sp.toString();
    return requestWithAuth<RfqDealOption[]>(`/api/rfqs/deals${qs ? `?${qs}` : ""}`);
  },
  listRfqRbacAdmins: () => requestWithAuth<RfqRbacAdminOption[]>("/api/rfqs/rbac-admins"),
  list: () => requestWithAuth<RfqSummaryDto[]>("/api/rfqs"),
  get: (id: string) => requestWithAuth<RfqDetailDto>(`/api/rfqs/${encodeURIComponent(id)}`),
  create: (body: {
    salesId: string;
    pricingAssigneeUserId: string;
    notesOverall?: string;
    items: Array<{ description: string; quantity: number; lineNote?: string }>;
  }) =>
    requestWithAuth<RfqDetailDto>("/api/rfqs", { method: "POST", body: JSON.stringify(body) }),
  patch: (
    id: string,
    body: Partial<{
      salesId: string;
      pricingAssigneeUserId: string;
      notesOverall: string;
      vatPercent: number | null;
      /** Persist pricing and set status to `draft` (after submit workflow). */
      saveAsDraft?: boolean;
      items: Array<{
        id?: string;
        description: string;
        quantity: number;
        lineNote?: string;
        unitBuyingPrice?: number | null;
        profitPerUnit?: number | null;
        unitSellingPrice?: number | null;
        vatPercent?: number | null;
      }>;
    }>,
  ) =>
    requestWithAuth<RfqDetailDto>(`/api/rfqs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  submit: (id: string) =>
    requestWithAuth<RfqDetailDto>(`/api/rfqs/${encodeURIComponent(id)}/submit`, { method: "POST" }),
  submitPricing: (id: string) =>
    requestWithAuth<RfqDetailDto>(`/api/rfqs/${encodeURIComponent(id)}/pricing`, { method: "POST" }),
  approve: (id: string) =>
    requestWithAuth<RfqDetailDto>(`/api/rfqs/${encodeURIComponent(id)}/approve`, { method: "POST" }),
  reject: (id: string, reason: string) =>
    requestWithAuth<RfqDetailDto>(`/api/rfqs/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  reopen: (id: string) =>
    requestWithAuth<RfqDetailDto>(`/api/rfqs/${encodeURIComponent(id)}/reopen`, { method: "POST" }),
  history: (id: string) =>
    requestWithAuth<RfqHistoryResponseDto>(`/api/rfqs/${encodeURIComponent(id)}/history`),
};

/** RBAC: none = no module access; user = own data scope; admin = full data scope (when APIs enforce). */
export type PageAccessType = "none" | "user" | "admin";

export type RbacMatrixRole = "admin" | "user";

export interface RbacPageDefinition {
  pageKey: string;
  label: string;
}

export interface RbacRoleDefaultsResponse {
  pages: RbacPageDefinition[];
  matrix: Record<RbacMatrixRole, Record<string, PageAccessType>>;
}

/** User row shown in RBAC assignment cells */
export interface RbacAssignmentUser {
  id: string;
  name: string;
  email: string;
}

/** Module → admin/user column user lists (explicit assignments only) */
export interface RbacAssignmentMatrixResponse {
  pages: RbacPageDefinition[];
  assignments: Record<string, { admin: RbacAssignmentUser[]; user: RbacAssignmentUser[] }>;
}

export const rbacApi = {
  listPages: () => requestWithAuth<{ pages: RbacPageDefinition[] }>("/api/rbac/pages"),
  getMyEffective: () =>
    requestWithAuth<{
      effective: Record<string, PageAccessType>;
      /** All modules for global admin; explicit RBAC rows only for standard users (sidebar + routes). */
      navPageKeys: string[];
    }>("/api/rbac/me"),
  /** Admin. Module × Admin/User columns with assigned users per cell. */
  getAssignmentMatrix: () => requestWithAuth<RbacAssignmentMatrixResponse>("/api/rbac/assignment-matrix"),
  /** Admin. Add or move a user to admin or user scope for a module. */
  postAssignment: (body: { userId: string; pageKey: string; accessType: "admin" | "user" }) =>
    requestWithAuth<RbacAssignmentMatrixResponse>("/api/rbac/assignments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  /** Admin. Assign several users to the same module + scope in one request. */
  postAssignmentsBatch: (body: {
    userIds: string[];
    pageKey: string;
    accessType: "admin" | "user";
  }) =>
    requestWithAuth<RbacAssignmentMatrixResponse>("/api/rbac/assignments/batch", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getRoleDefaults: () => requestWithAuth<RbacRoleDefaultsResponse>("/api/rbac/role-defaults"),
  putRoleDefaults: (body: {
    matrix: Record<RbacMatrixRole, Array<{ pageKey: string; accessType: PageAccessType }>>;
  }) =>
    requestWithAuth<RbacRoleDefaultsResponse>("/api/rbac/role-defaults", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getUserRbac: (userId: string) =>
    requestWithAuth<{
      userId: string;
      explicit: Array<{ pageKey: string; accessType: string }>;
      effective: Record<string, PageAccessType>;
    }>(`/api/rbac/users/${userId}`),
  putUserRbac: (userId: string, permissions: Array<{ pageKey: string; accessType: PageAccessType }>) =>
    requestWithAuth<{
      userId: string;
      explicit: Array<{ pageKey: string; accessType: string }>;
      effective: Record<string, PageAccessType>;
    }>(`/api/rbac/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    }),
  deleteUserPage: (userId: string, pageKey: string) =>
    requestWithAuth<{ ok: boolean; deleted: boolean }>(
      `/api/rbac/users/${userId}/pages/${encodeURIComponent(pageKey)}`,
      { method: "DELETE" },
    ),
};

// --- Report automations (HR Reports) ---

export type ReportScheduleType = "one_time" | "daily" | "weekly" | "monthly";

export interface ReportAutomationDto {
  id: string;
  reportName: string;
  reportType: string;
  reportTypeLabel?: string;
  description: string;
  scheduleType: ReportScheduleType;
  scheduleLabel?: string;
  startDate: string;
  executionTime: string;
  timezone: string;
  isActive: boolean;
  shiftIds?: string[];
  recipientUserIds?: string[];
  recipientsCount?: number;
  nextRunAt?: string | null;
  lastExecutionStatus?: "success" | "failed" | null;
  lastExecutionTime?: string | null;
  lastExecutionError?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportAutomationStatsDto {
  successRate: number;
  executionsThisMonth: number;
  activeReports: number;
  totalReports: number;
  activeReportsDelta: number;
}

export interface ReportRecipientDto {
  id: string;
  name: string;
  email: string;
  profilePicture?: string | null;
}

export interface ReportExecutionLogDto {
  id: string;
  reportAutomationId: string;
  reportName?: string;
  executionTime: string;
  status: "success" | "failed";
  recipientCount: number;
  recipients?: ReportRecipientDto[];
  filePath: string;
  errorMessage: string;
  createdAt: string;
}

export interface ReportExecutionLogsPage {
  items: ReportExecutionLogDto[];
  total: number;
  hasMore: boolean;
}

export type ReportAutomationPayload = {
  reportName: string;
  reportType: string;
  description?: string;
  scheduleType: ReportScheduleType;
  startDate: string;
  executionTime: string;
  timezone: string;
  isActive: boolean;
  shiftIds: string[];
  recipientUserIds: string[];
};

export const reportAutomationsApi = {
  stats: () => requestWithAuth<ReportAutomationStatsDto>("/api/report-automations/stats"),
  list: () => requestWithAuth<ReportAutomationDto[]>("/api/report-automations"),
  get: (id: string) => requestWithAuth<ReportAutomationDto>(`/api/report-automations/${id}`),
  create: (body: ReportAutomationPayload) =>
    requestWithAuth<ReportAutomationDto>("/api/report-automations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<ReportAutomationPayload>) =>
    requestWithAuth<ReportAutomationDto>(`/api/report-automations/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    requestWithAuth<{ ok: boolean }>(`/api/report-automations/${id}`, { method: "DELETE" }),
  toggle: (id: string, isActive: boolean) =>
    requestWithAuth<ReportAutomationDto>(`/api/report-automations/${id}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),
  sendNow: (id: string) =>
    requestWithAuth<{ log: ReportExecutionLogDto; recipientCount: number }>(
      `/api/report-automations/${id}/send-now`,
      { method: "POST" },
    ),
  listExecutionLogs: (automationId?: string, params?: { limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params?.limit != null) search.set("limit", String(params.limit));
    if (params?.offset != null) search.set("offset", String(params.offset));
    const qs = search.toString();
    const base = automationId
      ? `/api/report-automations/${automationId}/execution-logs`
      : "/api/report-automations/execution-logs";
    return requestWithAuth<ReportExecutionLogsPage>(qs ? `${base}?${qs}` : base);
  },
  downloadLogUrl: (logId: string) => `${getApiUrl()}/api/report-automations/execution-logs/${logId}/download`,
};
