import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultFilter } from "cmdk";
import {
  rbacApi,
  usersApi,
  type RbacAssignmentMatrixResponse,
  type RbacAssignmentUser,
  type RbacPageDefinition,
  type UserDto,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Loader } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RefreshCw, Plus, SquareCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRbac } from "@/contexts/RbacContext";

type ScopeCol = "admin" | "user";

const SCOPE_META: Record<
  ScopeCol,
  { label: string; hint: string; chipClass: string; hintClass: string; rowBg: string }
> = {
  admin: {
    label: "Admin",
    hint: "Full module data",
    chipClass:
      "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-800/60",
    hintClass: "text-amber-900/80 dark:text-amber-200/90",
    rowBg: "rounded-xl border border-amber-200/70 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20",
  },
  user: {
    label: "User",
    hint: "Own records only",
    chipClass:
      "bg-sky-100 text-sky-950 ring-1 ring-sky-200/90 dark:bg-sky-950/45 dark:text-sky-100 dark:ring-sky-800/50",
    hintClass: "text-sky-900/80 dark:text-sky-200/90",
    rowBg: "rounded-xl border border-sky-200/70 bg-sky-50/50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20",
  },
};

/** Scope accents for role chip, primary action, and selected rows (shell stays neutral). */
const PICKER_ACCENT: Record<
  ScopeCol,
  { roleChip: string; primaryBtn: string; rowSelected: string; rowSelectedCmdk: string }
> = {
  admin: {
    roleChip:
      "border-amber-500/90 bg-amber-100 text-amber-950 dark:border-amber-500 dark:bg-amber-950/80 dark:text-amber-50",
    primaryBtn:
      "h-11 min-w-[152px] rounded-xl border-0 bg-amber-600 px-6 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 focus-visible:ring-amber-500 dark:hover:bg-amber-500",
    rowSelected: "border-l-[3px] border-l-amber-600 bg-amber-50 dark:border-l-amber-400 dark:bg-amber-950/45",
    rowSelectedCmdk: "aria-selected:bg-amber-100/90 dark:aria-selected:bg-amber-950/55",
  },
  user: {
    roleChip:
      "border-sky-500/90 bg-sky-100 text-sky-950 dark:border-sky-500 dark:bg-sky-950/75 dark:text-sky-50",
    primaryBtn:
      "h-11 min-w-[152px] rounded-xl border-0 bg-sky-600 px-6 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 focus-visible:ring-sky-500 dark:hover:bg-sky-500",
    rowSelected: "border-l-[3px] border-l-sky-600 bg-sky-50 dark:border-l-sky-400 dark:bg-sky-950/45",
    rowSelectedCmdk: "aria-selected:bg-sky-100/90 dark:aria-selected:bg-sky-950/55",
  },
};

const PICKER_ACCENT_NEUTRAL = {
  roleChip:
    "border-slate-400 bg-slate-100 text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-50",
  primaryBtn:
    "h-11 min-w-[152px] rounded-xl border-0 bg-slate-900 px-6 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
  rowSelected: "border-l-[3px] border-l-slate-700 bg-slate-100 dark:border-l-slate-300 dark:bg-slate-800/90",
  rowSelectedCmdk: "aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800/70",
};

const MODULE_CHIP_CLASS =
  "inline-flex max-w-full flex-col items-start gap-0.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-left shadow-sm dark:border-slate-600 dark:bg-slate-900/90";

/** Match Credentials vault filter tabs — segmented control with indigo active state */
const rbacModuleTabsListClass =
  "inline-flex h-auto w-full min-w-0 flex-nowrap items-stretch justify-start gap-1 overflow-x-auto rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-100 to-slate-50 p-1.5 text-slate-600 dark:border-slate-700/90 dark:from-slate-950 dark:to-slate-900/95 dark:text-slate-300 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const rbacModuleTabsTriggerClass =
  "group relative inline-flex shrink-0 items-center justify-start gap-2 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-semibold tracking-tight text-slate-600 shadow-none outline-none transition-all duration-200 hover:bg-white/80 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/90 dark:hover:text-slate-50 dark:focus-visible:ring-indigo-400/35 dark:focus-visible:ring-offset-slate-950 sm:px-4 data-[state=active]:border-indigo-300/60 data-[state=active]:bg-white data-[state=active]:text-indigo-900 dark:data-[state=active]:border-indigo-500/45 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-indigo-50";

function userInitials(name: string, email: string) {
  const n = name.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function RbacSettings({ className }: { className?: string }) {
  const { refresh: refreshRbacNav } = useRbac();
  const [pages, setPages] = useState<RbacPageDefinition[]>([]);
  const [assignments, setAssignments] =
    useState<RbacAssignmentMatrixResponse["assignments"]>({});
  const [allUsers, setAllUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPageKey, setPickerPageKey] = useState<string | null>(null);
  const [pickerScope, setPickerScope] = useState<ScopeCol | null>(null);
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [activeModuleKey, setActiveModuleKey] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [matrixRes, usersRes] = await Promise.all([
        rbacApi.getAssignmentMatrix(),
        usersApi.list(),
      ]);
      setPages(matrixRes.pages);
      setAssignments(matrixRes.assignments);
      setAllUsers(usersRes);
      if (matrixRes.pages.length > 0) {
        setActiveModuleKey((prev) =>
          prev && matrixRes.pages.some((p) => p.pageKey === prev) ? prev : matrixRes.pages[0].pageKey,
        );
      }
    } catch {
      toast.error("Failed to load RBAC assignments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (pages.length === 0) return;
    const keys = new Set(pages.map((p) => p.pageKey));
    if (!activeModuleKey || !keys.has(activeModuleKey)) {
      setActiveModuleKey(pages[0].pageKey);
    }
  }, [pages, activeModuleKey]);

  const pickerCandidates = useMemo(() => {
    if (!pickerPageKey || !pickerScope) return [];
    const inAdmin = new Set((assignments[pickerPageKey]?.admin ?? []).map((u) => u.id));
    const inUser = new Set((assignments[pickerPageKey]?.user ?? []).map((u) => u.id));
    return allUsers.filter((u) => {
      if (u.isActive === false) return false;
      if (pickerScope === "admin") return !inAdmin.has(u.id);
      return !inUser.has(u.id);
    });
  }, [allUsers, assignments, pickerPageKey, pickerScope]);

  const filteredPickerCandidates = useMemo(() => {
    const q = pickerSearch.trim();
    if (!q) return pickerCandidates;
    return pickerCandidates.filter((u) => {
      const value = `${u.name ?? ""} ${u.email}`.trim();
      return defaultFilter(value, q) > 0;
    });
  }, [pickerCandidates, pickerSearch]);

  const openPicker = (pageKey: string, scope: ScopeCol) => {
    setPickerPageKey(pageKey);
    setPickerScope(scope);
    setPickerSelectedIds([]);
    setPickerSearch("");
    setPickerOpen(true);
  };

  const selectAllPickerVisible = useCallback(() => {
    setPickerSelectedIds((prev) => {
      const next = new Set(prev);
      for (const u of filteredPickerCandidates) {
        next.add(u.id);
      }
      return Array.from(next);
    });
  }, [filteredPickerCandidates]);

  const togglePickerUser = (userId: string) => {
    setPickerSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handlePickerSubmit = async () => {
    if (!pickerPageKey || !pickerScope || pickerSelectedIds.length === 0) return;
    const count = pickerSelectedIds.length;
    setBusy(true);
    try {
      const res = await rbacApi.postAssignmentsBatch({
        userIds: pickerSelectedIds,
        pageKey: pickerPageKey,
        accessType: pickerScope,
      });
      setAssignments(res.assignments);
      setPickerOpen(false);
      setPickerPageKey(null);
      setPickerScope(null);
      setPickerSelectedIds([]);
      await refreshRbacNav({ silent: true });
      toast.success(count === 1 ? "Assignment saved" : `${count} people assigned`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not assign users";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId: string, pageKey: string) => {
    setBusy(true);
    try {
      await rbacApi.deleteUserPage(userId, pageKey);
      const res = await rbacApi.getAssignmentMatrix();
      setAssignments(res.assignments);
      setPages(res.pages);
      await refreshRbacNav({ silent: true });
      toast.success("Removed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not remove";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const renderScopeColumn = (pageKey: string, scope: ScopeCol) => {
    const list: RbacAssignmentUser[] = assignments[pageKey]?.[scope] ?? [];
    const meta = SCOPE_META[scope];

    return (
      <div className={cn("space-y-3", meta.rowBg)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              meta.chipClass,
            )}
          >
            {meta.label}
            {list.length > 0 ? (
              <span
                className="tabular-nums"
                aria-label={`${list.length} ${list.length === 1 ? "person" : "people"}`}
              >
                ({list.length})
              </span>
            ) : null}
          </span>
          <span className={cn("hidden text-xs font-medium sm:inline", meta.hintClass)}>{meta.hint}</span>
        </div>
        <div className="flex min-h-[44px] flex-wrap content-start items-center gap-2">
          {list.map((u) => (
            <div
              key={`${pageKey}-${scope}-${u.id}`}
              className="flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white py-0.5 pl-0.5 pr-1 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-slate-500"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                title={u.email}
              >
                {userInitials(u.name ?? "", u.email)}
              </div>
              <span
                className="max-w-[min(140px,28vw)] truncate text-xs font-medium text-slate-900 dark:text-slate-100"
                title={u.email}
              >
                {u.name || u.email}
              </span>
              <button
                type="button"
                disabled={busy}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                aria-label={`Remove ${u.name}`}
                onClick={() => handleRemove(u.id, pageKey)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={busy}
            aria-label={`Add ${meta.label} access`}
            onClick={() => openPicker(pageKey, scope)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white/60 text-slate-500 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-slate-600 dark:bg-slate-950/40 dark:text-slate-400 dark:hover:border-primary dark:hover:text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return <Loader message="Loading access…" size="lg" className="py-16" />;
  }

  const pickerLabel =
    pickerPageKey && pages.find((p) => p.pageKey === pickerPageKey)?.label;
  const pickerScopeLabel = pickerScope ? SCOPE_META[pickerScope].label : "";
  const pickerAccent = pickerScope ? PICKER_ACCENT[pickerScope] : PICKER_ACCENT_NEUTRAL;

  const moduleLabelTrim = pickerLabel?.trim();
  const moduleKeyTrim = pickerPageKey?.trim();
  const moduleChipPrimary = (moduleLabelTrim || moduleKeyTrim || "").trim();
  const moduleChipShowKeyLine =
    !!moduleLabelTrim &&
    !!moduleKeyTrim &&
    moduleLabelTrim.toLowerCase() !== moduleKeyTrim.toLowerCase();

  return (
    <div className={cn("space-y-6", className)}>
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">RBAC</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Manage who has full module access versus own records only
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-2 self-start rounded-lg border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            onClick={() => load()}
            disabled={busy}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync
          </Button>
        </div>
      </div>

      {pages.length > 0 ? (
        <Tabs value={activeModuleKey} onValueChange={setActiveModuleKey} className="w-full min-w-0">
          <TabsList className={rbacModuleTabsListClass}>
            {pages.map((p) => (
              <TabsTrigger key={p.pageKey} value={p.pageKey} className={rbacModuleTabsTriggerClass}>
                <span className="block max-w-[10rem] truncate sm:max-w-[14rem]" title={p.label}>
                  {p.label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {pages.map((p) => (
            <TabsContent key={p.pageKey} value={p.pageKey} className="mt-4 min-w-0 outline-none focus-visible:outline-none">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                <div className="mb-4 border-b border-slate-200 pb-4 dark:border-slate-800">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{p.label}</h3>
                </div>

                <div className="flex flex-col gap-4">
                  {renderScopeColumn(p.pageKey, "admin")}
                  {renderScopeColumn(p.pageKey, "user")}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : null}

      <Dialog
        open={pickerOpen}
        onOpenChange={(o) => {
          setPickerOpen(o);
          if (!o) {
            setPickerPageKey(null);
            setPickerScope(null);
            setPickerSelectedIds([]);
            setPickerSearch("");
          }
        }}
      >
        <DialogContent
          className={cn(
            "flex max-h-[min(92vh,780px)] w-[calc(100%-1.25rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-700 dark:bg-slate-950",
          )}
        >
          <DialogHeader className="space-y-4 border-b border-slate-200 px-6 pb-5 pt-6 pr-14 text-left dark:border-slate-800">
            <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Add people
            </DialogTitle>
            <div className="flex flex-wrap items-start gap-2">
              {moduleChipPrimary ? (
                <div
                  className={MODULE_CHIP_CLASS}
                  title={moduleChipShowKeyLine ? pickerPageKey ?? undefined : undefined}
                >
                  <span className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50">
                    {moduleChipPrimary}
                  </span>
                  {moduleChipShowKeyLine && pickerPageKey ? (
                    <code className="max-w-[240px] truncate font-mono text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      {pickerPageKey}
                    </code>
                  ) : null}
                </div>
              ) : null}
              {pickerScope ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-lg border-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider",
                    pickerAccent.roleChip,
                  )}
                >
                  {pickerScopeLabel}
                </Badge>
              ) : null}
            </div>
            <DialogDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Search the directory and choose who should get this access.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden px-5 pb-1 pt-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
              <Command shouldFilter={false} className="overflow-hidden rounded-2xl border-0 bg-transparent shadow-none">
                <CommandInput
                  placeholder="Search by name or email…"
                  value={pickerSearch}
                  onValueChange={setPickerSearch}
                  className="h-12 border-0 border-b border-slate-200 bg-white text-base text-slate-900 placeholder:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500"
                />
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Team
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:ring-slate-500/40"
                    disabled={busy || filteredPickerCandidates.length === 0}
                    onClick={selectAllPickerVisible}
                  >
                    <SquareCheck className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />
                    Select all
                  </button>
                </div>
                <CommandList className="max-h-[min(52vh,460px)] bg-white dark:bg-slate-950">
                  <CommandEmpty className="py-14 text-center text-sm font-medium text-slate-600 dark:text-slate-400">
                    {pickerCandidates.length === 0 ? "No one to add." : "No matches for that search."}
                  </CommandEmpty>
                  <CommandGroup
                    className="p-2 [&_[cmdk-group-heading]]:hidden"
                    heading="Team"
                  >
                    {filteredPickerCandidates.map((u) => {
                      const checked = pickerSelectedIds.includes(u.id);
                      return (
                        <CommandItem
                          key={u.id}
                          value={`${u.name} ${u.email}`}
                          disabled={busy}
                          onSelect={() => togglePickerUser(u.id)}
                          className={cn(
                            "mb-1 cursor-pointer rounded-xl border border-transparent px-3 py-3 last:mb-0",
                            pickerAccent.rowSelectedCmdk,
                            checked && pickerAccent.rowSelected,
                          )}
                        >
                          <div className="flex w-full items-center gap-3">
                            <Checkbox
                              checked={checked}
                              className="pointer-events-none h-4 w-4 shrink-0 border-2 border-slate-400 data-[state=checked]:border-slate-900 data-[state=checked]:bg-slate-900 dark:border-slate-500 dark:data-[state=checked]:border-white dark:data-[state=checked]:bg-white dark:data-[state=checked]:text-slate-900"
                              aria-hidden
                              tabIndex={-1}
                            />
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                              {userInitials(u.name ?? "", u.email)}
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                                {u.name || u.email}
                              </p>
                              {u.name ? (
                                <p className="truncate text-xs font-medium text-slate-600 dark:text-slate-400">
                                  {u.email}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </div>

          <DialogFooter className="mt-auto gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {pickerSelectedIds.length === 0
                ? "No one selected"
                : `${pickerSelectedIds.length} selected`}
            </p>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
              <Button
                type="button"
                variant="ghost"
                className="h-11 flex-1 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50 sm:flex-initial sm:px-6"
                disabled={busy}
                onClick={() => setPickerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                className={cn(pickerAccent.primaryBtn)}
                disabled={busy || pickerSelectedIds.length === 0}
                onClick={() => void handlePickerSubmit()}
              >
                {busy
                  ? "Saving…"
                  : pickerSelectedIds.length > 0
                    ? `Add ${pickerSelectedIds.length}`
                    : "Add"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
