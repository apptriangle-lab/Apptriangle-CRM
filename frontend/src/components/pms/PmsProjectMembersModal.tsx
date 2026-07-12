import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { EmptyState } from "@/components/EmptyState";
import { RfqUserAvatar } from "@/components/rfq/RfqUserAvatar";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Crown,
  Loader2,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { usersApi, type UserDto } from "@/lib/api";
import { pmsApi, type PmsMemberDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";

type PmsProjectMembersModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  members: PmsMemberDto[];
  projectOwnerId?: string | null;
  canManage: boolean;
  onMembersChanged: () => Promise<void>;
};

function formatJoinedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return format(d, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function getMemberStatus(member: PmsMemberDto, userById: Map<string, UserDto>): string {
  const u = userById.get(member.userId);
  if (u) return u.isActive ? "Active" : "Inactive";
  return "Active";
}

export function PmsProjectMembersModal({
  open,
  onOpenChange,
  projectId,
  members,
  projectOwnerId,
  canManage,
  onMembersChanged,
}: PmsProjectMembersModalProps) {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [addUserSearch, setAddUserSearch] = useState("");
  const [addUserSearchOpen, setAddUserSearchOpen] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [addingUsers, setAddingUsers] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<PmsMemberDto | null>(null);
  const [localMembers, setLocalMembers] = useState<PmsMemberDto[]>(members);
  const [syncing, setSyncing] = useState(false);
  const addUserSearchAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setLocalMembers(members);
  }, [open]);

  useEffect(() => {
    if (open && !syncing) setLocalMembers(members);
  }, [open, members, syncing]);

  useEffect(() => {
    if (!open) return;
    setUsersLoading(true);
    usersApi
      .list()
      .then((list) => setUsers(list.filter((u) => u.isActive)))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setUsersLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setRoleFilter("all");
      setAddUserSearch("");
      setAddUserSearchOpen(false);
      setSelectedToAdd(new Set());
      setConfirmRemove(null);
    }
  }, [open]);

  const memberIds = useMemo(() => new Set(localMembers.map((m) => m.userId)), [localMembers]);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const unaddedUsers = useMemo(
    () => users.filter((u) => !memberIds.has(u.id)),
    [users, memberIds],
  );

  const searchMatchedUnaddedUsers = useMemo(() => {
    const q = addUserSearch.trim().toLowerCase();
    if (!q) return unaddedUsers;
    return unaddedUsers.filter((u) => {
      const name = (u.name ?? "").toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      const phone = (u.phone ?? "").toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [unaddedUsers, addUserSearch]);

  const selectedUsersToAdd = useMemo(
    () => unaddedUsers.filter((u) => selectedToAdd.has(u.id)),
    [unaddedUsers, selectedToAdd],
  );

  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    localMembers.forEach((m) => {
      const label = (m.roleLabel ?? "").trim() || "Member";
      roles.add(label);
    });
    return Array.from(roles).sort();
  }, [localMembers]);

  const filteredMembers = useMemo(() => {
    return localMembers.filter((m) => {
      const label =
        (m.roleLabel ?? "").trim() ||
        (projectOwnerId && m.userId === projectOwnerId ? "Owner" : "Member");
      if (roleFilter !== "all" && label !== roleFilter) return false;
      return true;
    });
  }, [localMembers, roleFilter, projectOwnerId]);

  const syncMembersInBackground = () => {
    setSyncing(true);
    void onMembersChanged().finally(() => setSyncing(false));
  };

  const toggleSelectUser = (userId: string, checked: boolean) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (selectedToAdd.size === 0) return;
    setAddingUsers(true);
    const ids = [...selectedToAdd];
    try {
      const added = await Promise.all(ids.map((id) => pmsApi.inviteMember(projectId, id)));
      const enriched = added.map((m, i) => {
        const picked = users.find((u) => u.id === ids[i]);
        return {
          ...m,
          userName: m.userName ?? picked?.name,
          userEmail: m.userEmail ?? picked?.email,
        };
      });
      setLocalMembers((prev) => [...prev, ...enriched]);
      setSelectedToAdd(new Set());
      setAddUserSearch("");
      setAddUserSearchOpen(false);
      toast.success(
        ids.length === 1 ? "1 user added to project" : `${ids.length} users added to project`,
      );
      syncMembersInBackground();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add users");
    } finally {
      setAddingUsers(false);
    }
  };

  const handleRemove = async (member: PmsMemberDto) => {
    setRemovingUserId(member.userId);
    try {
      await pmsApi.removeMember(projectId, member.userId);
      setLocalMembers((prev) => prev.filter((m) => m.userId !== member.userId));
      toast.success("User removed");
      setConfirmRemove(null);
      syncMembersInBackground();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setRemovingUserId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showClose
          className="flex max-h-[90vh] min-h-0 w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-0 shadow-xl"
        >
          <div className="shrink-0 border-b border-zinc-200 bg-white px-5 py-4 sm:px-6">
            <DialogHeader className="space-y-1 text-left">
              <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-950">
                      Project team
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-600">
                      {localMembers.length} on team
                      {canManage && unaddedUsers.length > 0 && (
                        <span className="ml-1">· {unaddedUsers.length} available to add</span>
                      )}
                      {syncing && <span className="ml-2 text-blue-600">· Saving…</span>}
                    </DialogDescription>
                  </div>
                </div>
            </DialogHeader>
          </div>

          <div className="flex min-h-[min(480px,55vh)] flex-1 flex-col overflow-hidden lg:flex-row">
            {canManage && (
              <aside className="flex min-h-0 shrink-0 flex-col border-b border-zinc-200 bg-zinc-50/30 lg:w-[min(420px,38%)] lg:border-b-0 lg:border-r">
                <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex items-start justify-between gap-3 border-b border-zinc-200/80 bg-gradient-to-br from-white via-zinc-50/40 to-indigo-50/30 px-4 py-4 sm:px-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
                        <UserPlus className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold tracking-tight text-zinc-950">
                          Add people
                        </p>
                        <p className="text-xs text-zinc-500">
                          Search, pick multiple users, then add them in one go
                        </p>
                      </div>
                    </div>
                    {!usersLoading && unaddedUsers.length > 0 && (
                      <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-indigo-700 ring-1 ring-indigo-100">
                        {unaddedUsers.length} available
                      </span>
                    )}
                  </div>

                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin sm:px-5">
                    {usersLoading ? (
                      <Loader message="Loading users…" className="py-10" />
                    ) : unaddedUsers.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-300/80 bg-white/70 px-4 py-8 text-center">
                        <p className="text-sm font-medium text-zinc-700">Everyone&apos;s on board</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          All active users are already on this project.
                        </p>
                      </div>
                    ) : (
                      <>
                        <Popover
                          open={addUserSearchOpen}
                          onOpenChange={setAddUserSearchOpen}
                          modal={false}
                        >
                          <PopoverAnchor asChild>
                            <div
                              ref={addUserSearchAnchorRef}
                              className={cn(
                                "group relative w-full rounded-xl border bg-white shadow-sm transition-all",
                                addUserSearchOpen
                                  ? "border-indigo-300 ring-2 ring-indigo-500/15"
                                  : "border-zinc-200 hover:border-zinc-300",
                              )}
                            >
                              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-indigo-500" />
                              <Input
                                type="search"
                                name="pms-invite-user-search"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                data-1p-ignore
                                data-lpignore="true"
                                data-form-type="other"
                                className="h-11 rounded-xl border-0 bg-transparent pl-10 pr-4 text-sm text-zinc-900 shadow-none placeholder:text-zinc-400 focus-visible:ring-0 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                                placeholder="Search by name, email, or phone…"
                                value={addUserSearch}
                                onChange={(e) => {
                                  setAddUserSearch(e.target.value);
                                  setAddUserSearchOpen(true);
                                }}
                                onFocus={(e) => {
                                  e.currentTarget.readOnly = false;
                                  setAddUserSearchOpen(true);
                                }}
                                readOnly
                              />
                            </div>
                          </PopoverAnchor>
                          <PopoverContent
                            align="start"
                            sideOffset={8}
                            className="w-[var(--radix-popover-anchor-width,var(--radix-popover-trigger-width))] overflow-hidden rounded-xl border-zinc-200/90 p-0 shadow-xl"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onCloseAutoFocus={(e) => e.preventDefault()}
                            onPointerDownOutside={(e) => {
                              if (addUserSearchAnchorRef.current?.contains(e.target as Node)) {
                                e.preventDefault();
                              }
                            }}
                            onFocusOutside={(e) => {
                              if (addUserSearchAnchorRef.current?.contains(e.target as Node)) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                People to add
                              </p>
                              <span className="text-[11px] font-medium tabular-nums text-zinc-400">
                                {searchMatchedUnaddedUsers.length} shown
                              </span>
                            </div>
                            <Command shouldFilter={false}>
                              <CommandList className="max-h-[min(280px,38vh)] p-1.5">
                                <CommandEmpty className="py-8 text-center text-sm text-zinc-500">
                                  No users match your search.
                                </CommandEmpty>
                                <CommandGroup>
                                  {searchMatchedUnaddedUsers.map((u) => {
                                    const isSelected = selectedToAdd.has(u.id);
                                    return (
                                      <CommandItem
                                        key={u.id}
                                        value={u.id}
                                        className={cn(
                                          "mb-0.5 cursor-pointer rounded-lg px-2.5 py-2.5 aria-selected:bg-transparent",
                                          isSelected
                                            ? "bg-indigo-50 ring-1 ring-indigo-100"
                                            : "hover:bg-zinc-50",
                                        )}
                                        onSelect={() => {
                                          toggleSelectUser(u.id, !isSelected);
                                          setAddUserSearchOpen(true);
                                        }}
                                      >
                                        <span
                                          className={cn(
                                            "mr-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                                            isSelected
                                              ? "border-indigo-600 bg-indigo-600 text-white"
                                              : "border-zinc-300 bg-white",
                                          )}
                                        >
                                          {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                                        </span>
                                        <RfqUserAvatar
                                          name={u.name}
                                          email={u.email}
                                          profilePicture={u.profilePicture}
                                          size="sm"
                                          className="ring-2 ring-white"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm font-medium text-zinc-900">
                                            {u.name}
                                          </p>
                                          <p className="truncate text-xs text-zinc-500">{u.email}</p>
                                        </div>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                            <div className="flex items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/60 px-3 py-2.5">
                              <span className="text-xs font-medium text-zinc-600">
                                {selectedToAdd.size > 0
                                  ? `${selectedToAdd.size} selected`
                                  : "Pick users to add"}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"
                                onClick={() => setAddUserSearchOpen(false)}
                              >
                                OK
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>

                        <div
                          className={cn(
                            "rounded-xl border transition-all",
                            selectedUsersToAdd.length > 0
                              ? "border-indigo-100 bg-white p-3 shadow-sm"
                              : "border-dashed border-zinc-200/80 bg-white/60 px-4 py-3",
                          )}
                        >
                          {selectedUsersToAdd.length > 0 ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="flex -space-x-2">
                                    {selectedUsersToAdd.slice(0, 4).map((u) => (
                                      <RfqUserAvatar
                                        key={u.id}
                                        name={u.name}
                                        email={u.email}
                                        profilePicture={u.profilePicture}
                                        size="sm"
                                        className="ring-2 ring-white"
                                      />
                                    ))}
                                  </span>
                                  {selectedUsersToAdd.length > 4 && (
                                    <span className="text-xs font-semibold text-zinc-500">
                                      +{selectedUsersToAdd.length - 4}
                                    </span>
                                  )}
                                  <p className="truncate text-xs font-medium text-zinc-600">
                                    {selectedUsersToAdd.length} ready to add
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className="shrink-0 text-xs font-semibold text-zinc-500 hover:text-zinc-800"
                                  onClick={() => setSelectedToAdd(new Set())}
                                >
                                  Clear all
                                </button>
                              </div>

                              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto scrollbar-thin">
                                {selectedUsersToAdd.map((u) => (
                                  <span
                                    key={u.id}
                                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/80 py-1 pl-1 pr-2 text-xs font-medium text-zinc-800"
                                  >
                                    <RfqUserAvatar
                                      name={u.name}
                                      email={u.email}
                                      profilePicture={u.profilePicture}
                                      size="sm"
                                    />
                                    <span className="max-w-[100px] truncate">{u.name}</span>
                                    <button
                                      type="button"
                                      className="rounded-md p-0.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                                      onClick={() => toggleSelectUser(u.id, false)}
                                      aria-label={`Remove ${u.name}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-center text-xs text-zinc-500">
                              Click the search field — pick people from the dropdown
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {!usersLoading && unaddedUsers.length > 0 && (
                    <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-3.5 sm:px-5">
                      <Button
                        type="button"
                        disabled={selectedToAdd.size === 0 || addingUsers}
                        className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
                        onClick={handleAddSelected}
                      >
                        {addingUsers ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Adding to project…
                          </>
                        ) : selectedToAdd.size > 0 ? (
                          <>
                            Add {selectedToAdd.size} to project
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        ) : (
                          "Add to project"
                        )}
                      </Button>
                    </div>
                  )}
                </section>
              </aside>
            )}

            <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-50/50">
              <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-950">Team members</p>
                      <p className="text-xs text-zinc-500">
                        {localMembers.length} with access to this project
                      </p>
                    </div>
                  </div>
                  {roleOptions.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRoleFilter("all")}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                          roleFilter === "all"
                            ? "bg-zinc-900 text-white"
                            : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100",
                        )}
                      >
                        All
                      </button>
                      {roleOptions.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRoleFilter(r)}
                          className={cn(
                            "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                            roleFilter === r
                              ? "bg-zinc-900 text-white"
                              : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100",
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
                  {usersLoading && localMembers.length === 0 ? (
                    <Loader message="Loading team…" className="py-16" />
                  ) : localMembers.length === 0 ? (
                    <div className="py-16">
                      <EmptyState
                        icon={Users}
                        title="No users yet"
                        description={
                          canManage
                            ? "Add people from the left panel."
                            : "This project has no team members assigned."
                        }
                      />
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="py-16">
                      <EmptyState title="No matches" description="Try a different role filter." />
                    </div>
                  ) : (
                    <ul className="divide-y divide-zinc-100 bg-white">
                      {filteredMembers.map((m) => {
                        const profile = userById.get(m.userId);
                        const isOwner = projectOwnerId && m.userId === projectOwnerId;
                        const status = getMemberStatus(m, userById);
                        const displayName = profile?.name ?? m.userName ?? "Member";
                        const displayEmail = profile?.email ?? m.userEmail ?? "—";
                        const displayRole =
                          m.roleLabel?.trim() || (isOwner ? "Owner" : "Member");

                        return (
                          <li
                            key={m.id}
                            className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <RfqUserAvatar
                                name={displayName}
                                email={displayEmail}
                                profilePicture={profile?.profilePicture}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-zinc-900">
                                  {displayName}
                                </p>
                                <p className="truncate text-xs text-zinc-500">{displayEmail}</p>
                                {isOwner && (
                                  <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-blue-700">
                                    <Crown className="h-3 w-3" />
                                    Project owner
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                              <span
                                className={cn(
                                  "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize",
                                  isOwner
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : "border-zinc-200 bg-zinc-50 text-zinc-600",
                                )}
                              >
                                {displayRole}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold",
                                  status === "Active"
                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                                    : "bg-zinc-100 text-zinc-500",
                                )}
                              >
                                {status}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-zinc-500">
                                <CalendarDays className="h-3.5 w-3.5 opacity-60" />
                                {formatJoinedDate(m.joinedAt ?? m.createdAt)}
                              </span>
                              {canManage && (
                                <>
                                  {isOwner ? (
                                    <span className="w-8 text-center text-xs text-zinc-400">—</span>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                      disabled={removingUserId === m.userId}
                                      onClick={() => setConfirmRemove(m)}
                                      aria-label={`Remove ${displayName}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-zinc-200 bg-white px-5 py-3.5 sm:justify-between sm:px-6">
            <p className="text-xs text-zinc-500">
              {canManage
                ? "Add people on the left, manage members on the right."
                : "View only — ask an admin to change membership."}
            </p>
            <Button
              type="button"
              variant="outline"
              className="rounded-lg border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRemove} onOpenChange={(v) => !v && setConfirmRemove(null)}>
        <AlertDialogContent className="rounded-xl border-zinc-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-950">Remove from project?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-600">
              <span className="font-medium text-zinc-900">
                {confirmRemove?.userName ?? confirmRemove?.userEmail}
              </span>{" "}
              will no longer have access to this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-lg border-zinc-300"
              disabled={!!removingUserId}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-red-600 text-white hover:bg-red-700"
              disabled={!!removingUserId}
              onClick={() => confirmRemove && handleRemove(confirmRemove)}
            >
              {removingUserId ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
