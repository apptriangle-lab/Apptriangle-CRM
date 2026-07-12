import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useRbac } from "@/contexts/RbacContext";
import { useTaskStore } from "@/contexts/TaskStoreContext";
import { companiesApi, usersApi, currenciesApi } from "@/lib/api";
import type { CurrencyDto } from "@/lib/api";
import { COUNTRIES } from "@/data/mockData";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskDeleteConfirmModal } from "@/components/tasks/TaskDeleteConfirmModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  PmsTaskDatePicker,
  formatDueDateLabel,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";
import {
  PmsAssigneeOptionRow,
  PmsMemberAvatar,
  PMS_ASSIGNEE_COMMAND_OVERRIDES,
} from "@/components/pms/PmsTaskAssigneesPicker";
import { Plus, Building2, Calendar, Check, CheckSquare, ChevronsUpDown, Trash2, UserRound, X } from "lucide-react";
import { cn, formatLocalDatetimeInput } from "@/lib/utils";

const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be under 200 characters"),
  note: z.string().max(1000, "Note must be under 1000 characters").optional(),
  companyId: z.string().min(1, "Company is required"),
  dueDatetime: z.string().min(1, "Due date is required"),
  assignByUserId: z.string().min(1, "Assign by is required"),
  assignToUserId: z.string().min(1, "Assign to is required"),
});

const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(100, "Name must be under 100 characters"),
  location: z.string().trim().min(1, "Location is required").max(200, "Location must be under 200 characters"),
  country: z.string().trim().min(1, "Country is required"),
  currencyId: z.string().min(1, "Currency is required"),
  kamUserId: z.string().min(1, "Key Account Manager is required"),
});

const emptyForm = { title: "", note: "", companyId: "", dueDatetime: "", assignByUserId: "", assignToUserId: "" };

type SaveOutcome = "close" | "new";

type UserOption = { id: string; name: string; email: string; phone: string };

type CompanyOption = { id: string; name: string; location: string; country: string };

function CompanyOptionRow({
  name,
  companyId,
  subtitle,
  selected,
}: {
  name: string;
  companyId: string;
  subtitle?: string;
  selected?: boolean;
}) {
  return (
    <>
      <PmsMemberAvatar name={name} userId={companyId} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {selected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
    </>
  );
}

function CompanyPillPicker({
  companyId,
  companies,
  onSelect,
  open,
  onOpenChange,
  onAddNew,
  placeholder = "Company",
}: {
  companyId: string;
  companies: CompanyOption[];
  onSelect: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddNew: (searchName: string) => void;
  placeholder?: string;
}) {
  const [searchValue, setSearchValue] = useState("");
  const selected = companies.find((c) => c.id === companyId);

  const filtered = useMemo(() => {
    const searchLower = searchValue.toLowerCase();
    if (!searchValue) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.location?.toLowerCase().includes(searchLower) ||
        c.country?.toLowerCase().includes(searchLower),
    );
  }, [companies, searchValue]);

  useEffect(() => {
    if (!open) setSearchValue("");
  }, [open]);

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 max-w-[200px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium hover:bg-slate-50",
            selected ? "text-slate-900" : "text-slate-600",
          )}
        >
          {selected ? (
            <>
              <PmsMemberAvatar name={selected.name} userId={selected.id} size="xs" />
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <>
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-72 rounded-xl border-slate-200 p-0 shadow-lg", PMS_ASSIGNEE_COMMAND_OVERRIDES)}
      >
        <Command shouldFilter={false} className={cn("rounded-xl", PMS_ASSIGNEE_COMMAND_OVERRIDES)}>
          <CommandInput
            placeholder="Search company, location or country…"
            value={searchValue}
            onValueChange={setSearchValue}
            className="h-10 border-0 border-b border-slate-100"
          />
          <CommandList className="max-h-[min(360px,55vh)] overflow-y-auto p-1.5">
            {filtered.length === 0 && searchValue && (
              <CommandEmpty className="py-6 text-center text-sm text-slate-500">No company found.</CommandEmpty>
            )}
            <CommandGroup className="p-0">
              {filtered.map((comp) => {
                const isOn = companyId === comp.id;
                const subtitle = [comp.location, comp.country].filter(Boolean).join(" · ");
                return (
                  <CommandItem
                    key={comp.id}
                    value={`${comp.name} ${comp.location} ${comp.country}`}
                    onSelect={() => {
                      onSelect(comp.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "mx-1 flex cursor-pointer items-center gap-3 rounded-lg bg-transparent px-2.5 py-2.5 text-slate-900 outline-none",
                      "data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-sky-50 data-[selected=true]:to-indigo-50",
                      isOn && "bg-indigo-50/80 text-indigo-950",
                    )}
                  >
                    <CompanyOptionRow
                      name={comp.name}
                      companyId={comp.id}
                      subtitle={subtitle || undefined}
                      selected={isOn}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandGroup className="p-0">
              <CommandItem
                value="add new company"
                onSelect={() => {
                  onAddNew(searchValue.trim());
                  onOpenChange(false);
                }}
                className={cn(
                  "mx-1 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 text-primary outline-none",
                  "data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-sky-50 data-[selected=true]:to-indigo-50",
                )}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">Add new company…</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function UserPillPicker({
  userId,
  users,
  onSelect,
  open,
  onOpenChange,
  placeholder,
  disabled,
}: {
  userId: string;
  users: UserOption[];
  onSelect: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const selected = users.find((u) => u.id === userId);

  if (disabled) {
    return (
      <span
        className={cn(
          "inline-flex h-7 max-w-[200px] items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[12px] font-medium text-slate-700",
        )}
      >
        {selected ? (
          <>
            <PmsMemberAvatar name={selected.name} userId={selected.id} size="xs" />
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span>—</span>
        )}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 max-w-[200px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium hover:bg-slate-50",
            selected ? "text-slate-900" : "text-slate-600",
          )}
        >
          {selected ? (
            <>
              <PmsMemberAvatar name={selected.name} userId={selected.id} size="xs" />
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <>
              <UserRound className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-72 rounded-xl border-slate-200 p-0 shadow-lg", PMS_ASSIGNEE_COMMAND_OVERRIDES)}
      >
        <Command className={cn("rounded-xl", PMS_ASSIGNEE_COMMAND_OVERRIDES)}>
          <CommandInput
            placeholder="Search by name, email or mobile…"
            className="h-10 border-0 border-b border-slate-100"
          />
          <CommandList className="max-h-[min(360px,55vh)] overflow-y-auto p-1.5">
            <CommandEmpty className="py-6 text-center text-sm text-slate-500">No user found.</CommandEmpty>
            <CommandGroup className="p-0">
              {users.map((u) => {
                const isOn = userId === u.id;
                return (
                  <CommandItem
                    key={u.id}
                    value={`${u.name} ${u.email} ${u.phone}`}
                    onSelect={() => {
                      onSelect(u.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "mx-1 flex cursor-pointer items-center gap-3 rounded-lg bg-transparent px-2.5 py-2.5 text-slate-900 outline-none",
                      "data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-sky-50 data-[selected=true]:to-indigo-50",
                      isOn && "bg-indigo-50/80 text-indigo-950",
                    )}
                  >
                    <PmsAssigneeOptionRow
                      name={u.name}
                      email={u.email}
                      userId={u.id}
                      subtitle={u.phone}
                      selected={isOn}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type TaskFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: string | null;
  defaultCompanyId?: string;
  onSuccess?: () => void;
};

export function TaskFormModal({ open, onOpenChange, editingId, defaultCompanyId, onSuccess }: TaskFormModalProps) {
  const { user } = useAuth();
  const { isPageScopeAdmin } = useRbac();
  const tasksScopeAdmin = isPageScopeAdmin("tasks");
  const { tasks, addTask, updateTask, deleteTask } = useTaskStore();

  const [companies, setCompanies] = useState<{ id: string; name: string; location: string; country: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; phone: string }[]>([]);

  // Task form states
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // UI popover states for Task form
  const [companyOpen, setCompanyOpen] = useState(false);
  const [assignByOpen, setAssignByOpen] = useState(false);
  const [assignToOpen, setAssignToOpen] = useState(false);
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false);
  const [showNote, setShowNote] = useState(false);

  // Add Company states
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({ name: "", location: "", country: "", currencyId: "", kamUserId: "" });
  const [addCompanySaving, setAddCompanySaving] = useState(false);
  const [addCompanyErrors, setAddCompanyErrors] = useState<Record<string, string>>({});
  const [currencies, setCurrencies] = useState<CurrencyDto[]>([]);
  const [addCompanyCountryOpen, setAddCompanyCountryOpen] = useState(false);
  const [addCompanyKamOpen, setAddCompanyKamOpen] = useState(false);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);

  const dueDateRange = useMemo<PmsDateRange>(
    () => ({
      startDate: null,
      endDate: form.endDatetime ? new Date(form.endDatetime) : null,
    }),
    [form.endDatetime],
  );

  const handleDueDateChange = (range: PmsDateRange) => {
    const d = range.endDate;
    if (d) {
      const updated = new Date(d);
      updated.setHours(0, 0, 0, 0);
      setForm((prev) => ({ ...prev, dueDatetime: formatLocalDatetimeInput(updated) }));
    } else {
      setForm((prev) => ({ ...prev, dueDatetime: "" }));
    }
  };

  const fetchCompanies = () =>
    companiesApi.list().then((list) => setCompanies(list.map((c) => ({ id: c.id, name: c.name, location: c.location ?? "", country: c.country ?? "" })))).catch(() => toast.error("Failed to load companies"));

  useEffect(() => {
    if (open) {
      if (companies.length === 0) fetchCompanies();
      if (users.length === 0) usersApi.list().then((list) => setUsers(list.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name, email: u.email ?? "", phone: u.phone ?? "" })))).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (addCompanyOpen) {
      currenciesApi.list().then(setCurrencies).catch(() => {});
    }
  }, [addCompanyOpen]);

  // Effect to reset or populate form when modal opens
  useEffect(() => {
    if (open) {
      setErrors({});
      if (editingId) {
        const t = tasks.find((x) => x.id === editingId);
        if (t) {
          setForm({
            title: t.title,
            note: t.note ?? "",
            companyId: t.companyId,
            dueDatetime: (() => {
              const d = new Date(t.endDatetime);
              d.setHours(0, 0, 0, 0);
              return formatLocalDatetimeInput(d);
            })(),
            assignByUserId: t.assignByUserId,
            assignToUserId: t.assignToUserId,
          });
          setShowNote(Boolean(t.note?.trim()));
        }
      } else {
        setForm({ ...emptyForm, assignByUserId: user?.id ?? "", companyId: defaultCompanyId ?? "" });
        setShowNote(false);
      }
    }
  }, [open, editingId, tasks, user, defaultCompanyId]);

  const resetForm = useCallback(() => {
    setForm({ ...emptyForm, assignByUserId: user?.id ?? "", companyId: defaultCompanyId ?? "" });
    setErrors({});
    setShowNote(false);
    setCompanyOpen(false);
    setAssignByOpen(false);
    setAssignToOpen(false);
    setDueDatePickerOpen(false);
  }, [user?.id, defaultCompanyId]);

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const focusTitle = useCallback(() => {
    requestAnimationFrame(() => {
      const el = titleInputRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.focus();
    });
  }, []);

  useEffect(() => {
    if (open && !editingId) {
      focusTitle();
    }
  }, [open, editingId, focusTitle]);

  const handleSave = async (outcome: SaveOutcome = "close") => {
    const result = taskSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    try {
      const dueDate = new Date(form.dueDatetime);
      dueDate.setHours(0, 0, 0, 0);
      const basePayload = {
        title: form.title.trim(),
        note: form.note.trim() || null,
        companyId: form.companyId,
        dueDatetime: formatLocalDatetimeInput(dueDate),
      };
      const payload = {
        ...basePayload,
        assignByUserId: form.assignByUserId,
        assignToUserId: form.assignToUserId,
      };
      if (editingId) {
        await updateTask(editingId, payload, user!.id);
        toast.success("Task updated successfully");
        onOpenChange(false);
        resetForm();
        if (onSuccess) onSuccess();
      } else {
        await addTask(payload, user!.id);
        toast.success("Task created successfully");
        if (onSuccess) onSuccess();
        if (outcome === "close") {
          onOpenChange(false);
          resetForm();
        } else {
          resetForm();
          focusTitle();
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      setErrors({ submit: "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    setDeleting(true);
    try {
      await deleteTask(taskId);
      toast.success("Task deleted");
      setDeleteOpen(false);
      if (editingId === taskId) {
        onOpenChange(false);
        resetForm();
        if (onSuccess) onSuccess();
      }
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setDeleting(false);
    }
  };

  const handleAddCompanySave = async () => {
    const result = companySchema.safeParse(newCompanyForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setAddCompanyErrors(fieldErrors);
      return;
    }
    setAddCompanySaving(true);
    setAddCompanyErrors({});
    try {
      const created = await companiesApi.create({
        name: newCompanyForm.name.trim(),
        location: newCompanyForm.location.trim(),
        country: newCompanyForm.country,
        currencyId: newCompanyForm.currencyId,
        kamUserId: newCompanyForm.kamUserId,
      });
      await fetchCompanies();
      setForm((prev) => ({ ...prev, companyId: created.id }));
      setAddCompanyOpen(false);
      setNewCompanyForm({ name: "", location: "", country: "", currencyId: "", kamUserId: "" });
      setAddCompanyErrors({});
      toast.success("Company added. You can now continue with the task.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add company");
      setAddCompanyErrors({ submit: err instanceof Error ? err.message : "Failed to add company" });
    } finally {
      setAddCompanySaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
        <DialogContent
          showClose={false}
          className="max-w-[720px] gap-0 overflow-hidden border-slate-200 bg-white p-0 font-[Inter,system-ui,sans-serif] shadow-2xl"
          onPointerDownOutside={(e) => {
            if (companyOpen || assignByOpen || assignToOpen || dueDatePickerOpen) e.preventDefault();
          }}
        >
          <div className="max-h-[min(72vh,640px)] overflow-y-auto">
            <div className="flex items-start justify-end px-4 pt-3">
              <button
                type="button"
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                onClick={handleClose}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pt-2 pb-1">
              <textarea
                ref={titleInputRef}
                rows={1}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !editingId) {
                    e.preventDefault();
                    void handleSave("close");
                  }
                }}
                placeholder="Task Name"
                className="w-full resize-none border-0 bg-transparent p-0 text-[28px] font-medium leading-tight text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
              />
              {errors.title && <p className="mt-1 text-[12px] text-destructive">{errors.title}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-4 px-6 pb-4">
              {!showNote ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800"
                  onClick={() => setShowNote(true)}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Add note
                </button>
              ) : null}
            </div>

            {showNote && (
              <div className="px-6 pb-4">
                <Textarea
                  autoFocus
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Add a note…"
                  className="min-h-[80px] resize-y border-slate-200 text-sm"
                />
                {errors.note && <p className="mt-1 text-[12px] text-destructive">{errors.note}</p>}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 px-6 pb-5">
              <CompanyPillPicker
                companyId={form.companyId}
                companies={companies}
                onSelect={(id) => setForm((prev) => ({ ...prev, companyId: id }))}
                open={companyOpen}
                onOpenChange={setCompanyOpen}
                onAddNew={(name) => {
                  setNewCompanyForm((prev) => ({ ...prev, name }));
                  setAddCompanyOpen(true);
                }}
              />

              <PmsTaskDatePicker
                value={dueDateRange}
                onChange={handleDueDateChange}
                open={dueDatePickerOpen}
                onOpenChange={setDueDatePickerOpen}
                endOnly
              >
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium hover:bg-slate-50",
                    dueDateRange.endDate ? "text-slate-900" : "text-slate-600",
                  )}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDueDateLabel(dueDateRange.endDate)}
                </button>
              </PmsTaskDatePicker>

              <UserPillPicker
                userId={form.assignByUserId}
                users={users}
                onSelect={(id) => setForm((prev) => ({ ...prev, assignByUserId: id }))}
                open={assignByOpen}
                onOpenChange={setAssignByOpen}
                placeholder="Assign by"
              />

              <UserPillPicker
                userId={form.assignToUserId}
                users={users}
                onSelect={(id) => setForm((prev) => ({ ...prev, assignToUserId: id }))}
                open={assignToOpen}
                onOpenChange={setAssignToOpen}
                placeholder="Assign to"
                disabled={Boolean(editingId && !tasksScopeAdmin)}
              />
            </div>

            {(errors.companyId || errors.endDatetime || errors.assignByUserId || errors.assignToUserId || errors.submit) && (
              <div className="space-y-0.5 px-6 pb-4">
                {errors.companyId && <p className="text-[12px] text-destructive">{errors.companyId}</p>}
                {errors.endDatetime && <p className="text-[12px] text-destructive">{errors.endDatetime}</p>}
                {errors.assignByUserId && <p className="text-[12px] text-destructive">{errors.assignByUserId}</p>}
                {errors.assignToUserId && <p className="text-[12px] text-destructive">{errors.assignToUserId}</p>}
                {errors.submit && <p className="text-[12px] text-destructive">{errors.submit}</p>}
              </div>
            )}
          </div>

          <div
            className={cn(
              "flex items-center gap-2 border-t border-slate-200 bg-white px-6 py-3",
              editingId ? "justify-between" : "justify-end",
            )}
          >
            {editingId ? (
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-md border-red-200 bg-white px-4 text-[13px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </Button>
            ) : null}
            <div className="flex items-center gap-2">
              {!editingId && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-md border-slate-200 px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  disabled={saving}
                  onClick={() => void handleSave("new")}
                >
                  {saving ? "Saving…" : "Create & New"}
                </Button>
              )}
              <Button
                type="button"
                className="h-8 rounded-md bg-slate-900 px-4 text-[13px] font-semibold text-white hover:bg-slate-800"
                disabled={saving}
                onClick={() => void handleSave("close")}
              >
                {saving ? "Saving…" : editingId ? "Update Task" : "Create Task"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addCompanyOpen}
        onOpenChange={(v) => {
          setAddCompanyOpen(v);
          if (!v) {
            setNewCompanyForm({ name: "", location: "", country: "", currencyId: "", kamUserId: "" });
            setAddCompanyErrors({});
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Company Name *</Label>
              <Input
                value={newCompanyForm.name}
                onChange={(e) => setNewCompanyForm({ ...newCompanyForm, name: e.target.value })}
                placeholder="Enter company name"
              />
              {addCompanyErrors.name && <p className="text-sm text-destructive">{addCompanyErrors.name}</p>}
            </div>
            <div className="space-y-1">
              <Label>Location *</Label>
              <Input
                value={newCompanyForm.location}
                onChange={(e) => setNewCompanyForm({ ...newCompanyForm, location: e.target.value })}
                placeholder="City, State"
              />
              {addCompanyErrors.location && <p className="text-sm text-destructive">{addCompanyErrors.location}</p>}
            </div>
            <div className="space-y-1">
              <Label>Country *</Label>
              <Popover open={addCompanyCountryOpen} onOpenChange={setAddCompanyCountryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={addCompanyCountryOpen}
                    className="w-full justify-between font-normal"
                  >
                    {newCompanyForm.country || "Select country"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] max-h-[min(320px,70vh)] p-0 overflow-hidden flex flex-col"
                  align="start"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <Command className="flex flex-col max-h-full min-h-0">
                    <CommandInput placeholder="Search country..." />
                    <CommandList className="flex-1 min-h-0">
                      <CommandEmpty>No country found.</CommandEmpty>
                      <CommandGroup>
                        {COUNTRIES.map((c) => (
                          <CommandItem
                            key={c}
                            value={c}
                            onSelect={() => {
                              setNewCompanyForm({ ...newCompanyForm, country: c });
                              setAddCompanyCountryOpen(false);
                            }}
                          >
                            {c}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {addCompanyErrors.country && <p className="text-sm text-destructive">{addCompanyErrors.country}</p>}
            </div>
            <div className="space-y-1">
              <Label>Currency *</Label>
              <Select
                value={newCompanyForm.currencyId || ""}
                onValueChange={(v) => setNewCompanyForm({ ...newCompanyForm, currencyId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((cur) => (
                    <SelectItem key={cur.id} value={cur.id}>
                      {cur.code} — {cur.name}{cur.symbol ? ` (${cur.symbol})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addCompanyErrors.currencyId && <p className="text-sm text-destructive">{addCompanyErrors.currencyId}</p>}
            </div>
            <div className="space-y-1">
              <Label>Key Account Manager (KAM) *</Label>
              <Popover open={addCompanyKamOpen} onOpenChange={setAddCompanyKamOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={addCompanyKamOpen}
                    className="w-full justify-between font-normal"
                  >
                    {newCompanyForm.kamUserId
                      ? (users.find((x) => x.id === newCompanyForm.kamUserId)?.name ?? "Select KAM")
                      : "Select KAM"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] max-h-[min(320px,70vh)] p-0 overflow-hidden flex flex-col"
                  align="start"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <Command className="flex flex-col max-h-full min-h-0">
                    <CommandInput placeholder="Search by name, email or mobile..." />
                    <CommandList className="flex-1 min-h-0">
                      <CommandEmpty>No user found.</CommandEmpty>
                      <CommandGroup>
                        {users.map((u) => (
                          <CommandItem
                            key={u.id}
                            value={`${u.name} ${u.email} ${u.phone}`}
                            onSelect={() => {
                              setNewCompanyForm((prev) => ({ ...prev, kamUserId: u.id }));
                              setAddCompanyKamOpen(false);
                            }}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium">{u.name}</span>
                              {(u.email || u.phone) && (
                                <span className="text-xs text-muted-foreground">
                                  {[u.email, u.phone].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {addCompanyErrors.kamUserId && <p className="text-sm text-destructive">{addCompanyErrors.kamUserId}</p>}
            </div>
            {addCompanyErrors.submit && <p className="text-sm text-destructive">{addCompanyErrors.submit}</p>}
            <Button onClick={handleAddCompanySave} disabled={addCompanySaving} className="w-full">
              {addCompanySaving ? "Saving…" : "Add company"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editingId ? (
        <TaskDeleteConfirmModal
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          taskTitle={form.title.trim() || tasks.find((t) => t.id === editingId)?.title || ""}
          deleting={deleting}
          onConfirm={() => void handleDelete(editingId)}
        />
      ) : null}
    </>
  );
}
