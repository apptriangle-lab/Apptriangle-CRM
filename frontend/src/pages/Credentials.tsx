import { useCallback, useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useRbac } from "@/contexts/RbacContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  credentialsApi,
  usersApi,
  type CredentialDetailDto,
  type CredentialShareDto,
  type CredentialSharePreviewDto,
  type CredentialSummaryDto,
  type UserDto,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateSecurePassword, getPasswordStrength } from "@/lib/passwordStrength";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  AlertTriangle,
  Infinity,
  Calendar,
  Check,
  Users,
  User,
  Shield,
} from "lucide-react";

type TabKey = "mine" | "shared" | "all";

type ShareDefaultExpiryMode = "forever" | "custom";

/** Detail modal: only one of username or password may be visible at a time */
type DetailRevealField = null | "username" | "password";

function maskSecret(): string {
  return "••••••••••••";
}

/** Only http(s) values are opened as links; anything else is shown as plain text. */
function isNavigableHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

/** Collapsed username in table/detail: first two chars + bullets from API, or legacy mask. */
function credentialUsernameCollapsedLabel(c: {
  usernameMaskedDisplay?: string;
  usernameMasked?: string;
  username?: string | null;
}): string {
  if (c.usernameMaskedDisplay !== undefined) {
    return c.usernameMaskedDisplay === "" ? "—" : c.usernameMaskedDisplay;
  }
  return c.usernameMasked || c.username || "—";
}

function strengthBlockClass(score: number) {
  if (score <= 1) return "bg-red-500";
  if (score === 2) return "bg-orange-500";
  if (score === 3) return "bg-amber-500";
  if (score === 4) return "bg-yellow-500";
  if (score === 5) return "bg-lime-500";
  return "bg-emerald-500";
}

const shareAvatarRing = "ring-2 ring-background";

const shareAvatarPalette = [
  "bg-indigo-600 text-white dark:bg-indigo-500",
  "bg-violet-600 text-white dark:bg-violet-500",
  "bg-fuchsia-600 text-white dark:bg-fuchsia-500",
  "bg-sky-600 text-white dark:bg-sky-500",
  "bg-emerald-600 text-white dark:bg-emerald-500",
  "bg-amber-600 text-white dark:bg-amber-600",
];

function initialsFromDisplayName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]![0] ?? "";
    const b = parts[parts.length - 1]![0] ?? "";
    return (a + b).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function datetimeLocalToIso(local: string): string | undefined {
  const t = local.trim();
  if (!t) return undefined;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** Compact text for scheduled-expiry chip in People with access. */
function formatShareExpiryChipLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCredentialDetailDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function ShareModalUserAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  return (
    <Avatar
      className={cn(
        "h-9 w-9 shrink-0 border border-border/50 shadow-sm ring-1 ring-background",
        className,
      )}
    >
      {src ? <AvatarImage src={src} alt="" className="object-cover" /> : null}
      <AvatarFallback className="bg-indigo-500/12 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
        {initialsFromDisplayName(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function ShareRecipientsStack({
  recipients,
  className,
}: {
  recipients: CredentialSharePreviewDto[];
  /** e.g. `justify-start` for left-aligned stacks in modals */
  className?: string;
}) {
  const max = 4;
  const shown = recipients.slice(0, max);
  const rest = recipients.length - max;
  const names = recipients.map((r) => r.name);
  if (shown.length === 0) return <span className="text-muted-foreground/50">—</span>;
  return (
    <div
      className={cn("flex min-h-[1.75rem] items-center justify-center", className)}
      title={names.join(", ")}
      role="group"
      aria-label={`Shared with ${recipients.length} ${recipients.length === 1 ? "person" : "people"}: ${names.join(", ")}`}
    >
      <div className="flex items-center pl-1.5">
        {shown.map((r, i) => (
          <Avatar
            key={`${r.name}-${i}`}
            className={cn("-ml-1.5 h-7 w-7 shrink-0 border-0 shadow-sm first:ml-0", shareAvatarRing)}
            style={{ zIndex: shown.length - i }}
          >
            {r.profilePicture ? (
              <AvatarImage src={r.profilePicture} alt="" className="object-cover" />
            ) : null}
            <AvatarFallback
              className={cn(
                "text-[10px] font-bold tabular-nums",
                shareAvatarPalette[i % shareAvatarPalette.length],
              )}
            >
              {initialsFromDisplayName(r.name)}
            </AvatarFallback>
          </Avatar>
        ))}
        {rest > 0 && (
          <div className="-ml-1.5 z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground ring-2 ring-background dark:bg-muted/80">
            +{rest}
          </div>
        )}
      </div>
    </div>
  );
}

const fieldClass = "mt-1.5 h-11 rounded-lg border border-input bg-background text-[15px] shadow-sm";

const fieldAreaClass = "mt-1.5 min-h-[88px] rounded-lg border border-input bg-background py-2.5 text-[15px] shadow-sm";

const labelClassModal = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

const modalShell =
  "max-h-[90vh] overflow-y-auto border border-border bg-background text-foreground shadow-lg sm:rounded-2xl";

/** Share credential dialog — near full viewport width; fixed height so empty/short lists don’t shrink the dialog */
const shareModalShell =
  "flex min-h-0 h-[min(92vh,960px)] w-[calc(100vw-1rem)] !max-w-[calc(100vw-1rem)] max-h-[min(96vh,980px)] flex-col gap-0 overflow-hidden border-0 bg-gradient-to-b from-card to-muted/[0.35] p-0 text-foreground shadow-xl ring-1 ring-indigo-500/10 dark:from-card dark:to-muted/20 dark:ring-indigo-400/15 sm:rounded-2xl sm:!max-w-[min(100vw-1rem,1600px)]";

/** Credential detail — same chrome as share, but height follows content (no forced tall shell). */
const detailModalShell =
  "flex min-h-0 w-[calc(100vw-1rem)] !max-w-[calc(100vw-1rem)] max-h-[min(92vh,960px)] flex-col gap-0 overflow-hidden border-0 bg-gradient-to-b from-card to-muted/[0.35] p-0 text-foreground shadow-xl ring-1 ring-indigo-500/10 dark:from-card dark:to-muted/20 dark:ring-indigo-400/15 sm:rounded-2xl sm:!max-w-[min(100vw-1rem,1600px)]";

/** New / edit credential dialog — wider, shorter, focus rings */
const credFormModalClass =
  "max-h-[min(68vh,520px)] overflow-y-auto border-0 bg-gradient-to-b from-card to-muted/[0.35] p-0 text-foreground shadow-2xl ring-1 ring-indigo-500/15 dark:from-card dark:to-muted/20 dark:ring-indigo-400/20 sm:rounded-2xl";

const credFormHeaderClass =
  "border-b border-border/70 bg-gradient-to-br from-indigo-500/[0.12] via-violet-500/[0.06] to-transparent px-6 pb-3 pt-4 dark:from-indigo-500/[0.18] dark:via-violet-500/[0.08] dark:to-transparent";

const credFormLabelClass =
  "text-xs font-semibold uppercase tracking-[0.06em] text-foreground/80 dark:text-foreground/75";

const credFormFieldClass =
  "mt-1 h-10 rounded-lg border border-border/90 bg-background text-[15px] text-foreground shadow-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/75 focus-visible:border-indigo-500/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-border dark:bg-muted/25";

const credFormAreaClass =
  "mt-1 min-h-[72px] rounded-lg border border-border/90 bg-background py-2 text-[15px] text-foreground shadow-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/75 focus-visible:border-indigo-500/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-border dark:bg-muted/25";

/** Credentials data grid — card shell + sticky header */
const credTableShell =
  "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08),0_0_0_1px_rgba(15,23,42,0.04)] dark:border-border/50 dark:bg-card/95 dark:shadow-[0_2px_16px_-4px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)]";

const credTableHeaderClass =
  "sticky top-0 z-10 border-b border-border/50 bg-gradient-to-b from-muted/55 to-muted/25 backdrop-blur-md [&_tr]:border-0 [&_tr]:!bg-transparent [&_th]:h-11 [&_th]:px-3 [&_th]:py-3 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.07em] [&_th]:text-muted-foreground/90 first:[&_th]:pl-4 last:[&_th]:pr-4";

const credTableRowClass =
  "group border-b border-border/25 transition-colors duration-150 hover:bg-muted/40 dark:border-border/20 dark:hover:bg-muted/25";

/** Data columns share remaining width; actions column is fixed (see colgroup below). */
const credTableColData = "w-[calc((100%-4rem)/6)]";
/** Six equal columns when the actions column is omitted (Shared with me). */
const credTableColDataEqual = "w-[16.666%]";
const credTableColActions = "w-16";

const credIconGroup =
  "inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border/40 bg-muted/25 p-0.5 shadow-inner dark:border-border/30 dark:bg-muted/15";

/** Vault filter — segmented control with strong active vs inactive contrast */
const credVaultTabsListClass =
  "inline-flex h-auto w-full min-w-0 flex-nowrap items-stretch justify-start gap-1 overflow-x-auto rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-100 to-slate-50 p-1.5 text-slate-600 dark:border-slate-700/90 dark:from-slate-950 dark:to-slate-900/95 dark:text-slate-300 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const credVaultTabsTriggerClass =
  "group relative inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-sm font-semibold tracking-tight text-slate-600 shadow-none outline-none transition-all duration-200 hover:bg-white/80 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/90 dark:hover:text-slate-50 dark:focus-visible:ring-indigo-400/35 dark:focus-visible:ring-offset-slate-950 sm:px-4 data-[state=active]:border-indigo-300/60 data-[state=active]:bg-white data-[state=active]:text-indigo-900 dark:data-[state=active]:border-indigo-500/45 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-indigo-50";

const credVaultTabIconClass =
  "h-4 w-4 shrink-0 text-slate-500 transition-colors group-data-[state=active]:text-indigo-600 dark:text-slate-500 dark:group-data-[state=active]:text-indigo-300";

/** Row ⋮ menu — elevated panel + indigo hover; destructive row uses red tint */
const credRowMenuTriggerClass =
  "h-9 w-9 shrink-0 rounded-full text-muted-foreground transition-[color,box-shadow,background-color] hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-indigo-50 data-[state=open]:text-indigo-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus-visible:ring-indigo-400/45 dark:data-[state=open]:bg-indigo-950/50 dark:data-[state=open]:text-indigo-100";

const credRowMenuContentClass =
  "min-w-[11.5rem] overflow-hidden rounded-2xl border border-slate-200/95 bg-white/95 p-1.5 text-slate-900 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.22),0_0_0_1px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-slate-600/90 dark:bg-slate-950/95 dark:text-slate-100 dark:shadow-[0_16px_48px_-10px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.06)]";

const credRowMenuItemClass =
  "cursor-pointer gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-800 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-indigo-500/[0.12] data-[highlighted]:text-slate-950 focus:bg-indigo-500/[0.12] focus:text-slate-950 dark:text-slate-200 dark:data-[highlighted]:bg-indigo-500/20 dark:data-[highlighted]:text-white dark:focus:bg-indigo-500/20 dark:focus:text-white";

const credRowMenuItemDestructiveClass =
  "cursor-pointer gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-red-600 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-red-500/12 data-[highlighted]:text-red-700 focus:bg-red-500/12 focus:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-500/15 dark:data-[highlighted]:text-red-300 dark:focus:bg-red-500/15 dark:focus:text-red-300";

const credRowMenuSeparatorClass = "my-1.5 bg-slate-200/90 dark:bg-slate-600/80";

export default function Credentials() {
  const { user } = useAuth();
  const { isPageScopeAdmin } = useRbac();
  const credAdmin = isPageScopeAdmin("credentials");

  const [tab, setTab] = useState<TabKey>("mine");
  const [items, setItems] = useState<CredentialSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserDto[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const hasTitle = title.trim().length > 0;
  const hasUsername = username.trim().length > 0;
  const hasPassword = password.trim().length > 0;

  const canSaveCredential = hasTitle && hasUsername && hasPassword;

  const [detail, setDetail] = useState<CredentialDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  /** Detail modal eye buttons: which reveal/hide API call is in flight (`both` = hide secrets). */
  const [detailEyeBusyField, setDetailEyeBusyField] = useState<null | "username" | "password" | "both">(null);
  const [detailRevealField, setDetailRevealField] = useState<DetailRevealField>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareCredId, setShareCredId] = useState<string | null>(null);
  const [shareExpiry, setShareExpiry] = useState("");
  const [shareDefaultExpiryMode, setShareDefaultExpiryMode] = useState<ShareDefaultExpiryMode>("forever");
  const [sharesList, setSharesList] = useState<CredentialShareDto[]>([]);
  const [shareListLoading, setShareListLoading] = useState(false);
  const [shareUserSearch, setShareUserSearch] = useState("");
  const [debouncedShareSearch, setDebouncedShareSearch] = useState("");
  const [shareSelectedUserIds, setShareSelectedUserIds] = useState<string[]>([]);
  const [shareBulkAdding, setShareBulkAdding] = useState(false);
  const [shareExpirySavingShareId, setShareExpirySavingShareId] = useState<string | null>(null);
  const [shareRevokingShareId, setShareRevokingShareId] = useState<string | null>(null);
  const [rowExpiryDraft, setRowExpiryDraft] = useState<Record<string, string>>({});

  const [deleteId, setDeleteId] = useState<string | null>(null);
  /** Eye/reveal fetch in progress per `credentialId-field` */
  const [tableRevealBusyKey, setTableRevealBusyKey] = useState<string | null>(null);
  /** Copy (API) in progress per `credentialId-field` — separate so Copy doesn’t spin with Eye */
  const [tableCopyBusyKey, setTableCopyBusyKey] = useState<string | null>(null);
  /** Plaintext shown in table after Eye; cleared on list refresh */
  const [tableReveal, setTableReveal] = useState<Record<string, { username?: string; password?: string }>>({});

  useEffect(() => {
    if (!credAdmin && tab === "all") setTab("mine");
  }, [credAdmin, tab]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = { q: search || undefined };
      let data: CredentialSummaryDto[];
      if (tab === "mine") data = await credentialsApi.listMine(params);
      else if (tab === "shared") data = await credentialsApi.listSharedWithMe(params);
      else data = await credentialsApi.listAll(params);
      setItems(data);
      setTableReveal({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load credentials");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    usersApi
      .list()
      .then((list) => setUsers(list.filter((u) => u.isActive)))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedShareSearch(shareUserSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [shareUserSearch]);

  useEffect(() => {
    if (!shareOpen) {
      setRowExpiryDraft({});
      setShareUserSearch("");
      setDebouncedShareSearch("");
      setShareSelectedUserIds([]);
      setShareDefaultExpiryMode("forever");
      setShareExpiry("");
    }
  }, [shareOpen]);

  useEffect(() => {
    if (!shareOpen) return;
    usersApi
      .list()
      .then((list) => setUsers(list.filter((u) => u.isActive)))
      .catch(() => {});
  }, [shareOpen]);

  const openCreate = () => {
    setEditingId(null);
    setTitle("");
    setUsername("");
    setPassword("");
    setUrl("");
    setNote("");
    setFormOpen(true);
  };

  const openEdit = async (c: CredentialSummaryDto) => {
    setEditingId(c.id);
    setTitle(c.title);
    setPassword("");
    setUrl(c.url || "");
    setNote(c.note || "");
    setUsername(c.usernameMasked || "");
    setFormOpen(true);
    if (!(c.accessLevel === "owner" || c.accessLevel === "admin")) return;
    try {
      const d = await credentialsApi.get(c.id, true);
      setUsername(d.username || "");
      setPassword(d.password ?? "");
      setUrl(d.url || "");
      setNote(d.note || "");
    } catch {
      toast.error("Could not load credential for editing");
    }
  };

  const handleOpenEditFromDetail = () => {
    if (!detail) return;
    const d = detail;
    setDetail(null);
    setDetailEyeBusyField(null);
    void openEdit(d);
  };

  const saveCredential = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!password.trim()) {
      toast.error("Password is required");
      return;
    }
    const urlTrim = url.trim();

    setFormSaving(true);
    try {
      if (editingId) {
        const body: Record<string, unknown> = {
          title: title.trim(),
          username: username.trim(),
          password,
          url: urlTrim,
          note,
        };
        const updated = await credentialsApi.update(editingId, body);
        toast.success("Credential updated");
        if (detail?.id === editingId) {
          setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
          setDetailRevealField(null);
        }
      } else {
        await credentialsApi.create({
          title: title.trim(),
          username: username.trim(),
          password,
          url: urlTrim,
          note,
        });
        toast.success("Credential created");
      }
      setFormOpen(false);
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setFormSaving(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetail(null);
    setDetailRevealField(null);
    setDetailEyeBusyField(null);
    setDetailLoading(true);
    try {
      const d = await credentialsApi.get(id, false);
      setDetail(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open");
    } finally {
      setDetailLoading(false);
    }
  };

  const detailHasPlaintextSecrets = (d: CredentialDetailDto | null) =>
    Boolean(d && d.username != null && d.password != null);

  const hideDetailSecrets = async () => {
    setDetailRevealField(null);
    if (!detail) return;
    setDetailEyeBusyField("both");
    setDetailLoading(true);
    try {
      const d = await credentialsApi.get(detail.id, false);
      setDetail(d);
    } catch {
      /* keep prior detail */
    } finally {
      setDetailLoading(false);
      setDetailEyeBusyField(null);
    }
  };

  const revealDetailField = async (field: "username" | "password") => {
    if (!detail) return;
    if (detailRevealField === field) {
      await hideDetailSecrets();
      return;
    }
    if (detailHasPlaintextSecrets(detail)) {
      setDetailRevealField(field);
      return;
    }
    setDetailEyeBusyField(field);
    setDetailLoading(true);
    try {
      const d = await credentialsApi.get(detail.id, true);
      setDetail(d);
      setDetailRevealField(field);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot reveal secrets");
    } finally {
      setDetailLoading(false);
      setDetailEyeBusyField(null);
    }
  };

  const copyPassword = async (plain: string, successMessage = "Copied to clipboard") => {
    try {
      await navigator.clipboard.writeText(plain);
      toast.success(successMessage);
    } catch {
      toast.error("Clipboard not available");
    }
  };

  const copyDetailUsername = async () => {
    if (!detail) return;
    if (detailRevealField === "username" && detail.username) {
      await copyPassword(detail.username, "Username copied");
      return;
    }
    if (detailHasPlaintextSecrets(detail) && detail.username) {
      await copyPassword(detail.username, "Username copied");
      return;
    }
    setDetailLoading(true);
    try {
      const d = await credentialsApi.get(detail.id, true);
      await copyPassword(d.username ?? "", "Username copied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not copy username");
    } finally {
      setDetailLoading(false);
    }
  };

  const copyDetailPassword = async () => {
    if (!detail) return;
    if (detailRevealField === "password" && detail.password != null) {
      await copyPassword(detail.password, "Password copied");
      return;
    }
    if (detailHasPlaintextSecrets(detail) && detail.password != null) {
      await copyPassword(detail.password, "Password copied");
      return;
    }
    setDetailLoading(true);
    try {
      const d = await credentialsApi.get(detail.id, true);
      await copyPassword(d.password ?? "", "Password copied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not copy password");
    } finally {
      setDetailLoading(false);
    }
  };

  const copyTableField = async (
    e: React.MouseEvent,
    c: CredentialSummaryDto,
    tabKey: TabKey,
    field: "username" | "password",
  ) => {
    e.stopPropagation();
    if (tabKey === "shared" && c.isExpired) {
      toast.error("This share has expired");
      return;
    }
    const cached = tableReveal[c.id];
    if (field === "username" && cached?.username !== undefined) {
      try {
        await navigator.clipboard.writeText(cached.username);
        toast.success("Username copied");
      } catch {
        toast.error("Clipboard not available");
      }
      return;
    }
    if (field === "password" && cached?.password !== undefined) {
      try {
        await navigator.clipboard.writeText(cached.password);
        toast.success("Password copied");
      } catch {
        toast.error("Clipboard not available");
      }
      return;
    }
    const busyKey = `${c.id}-${field}`;
    setTableCopyBusyKey(busyKey);
    try {
      const d = await credentialsApi.get(c.id, true);
      const text = field === "username" ? (d.username ?? "") : (d.password ?? "");
      await navigator.clipboard.writeText(text);
      toast.success(field === "username" ? "Username copied" : "Password copied");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy");
    } finally {
      setTableCopyBusyKey(null);
    }
  };

  const toggleTableFieldReveal = (
    e: React.MouseEvent,
    c: CredentialSummaryDto,
    tabKey: TabKey,
    field: "username" | "password",
  ) => {
    e.stopPropagation();
    if (tabKey === "shared" && c.isExpired) {
      toast.error("This share has expired");
      return;
    }
    const row = tableReveal[c.id];
    const isShown = field === "username" ? row?.username !== undefined : row?.password !== undefined;
    if (isShown) {
      setTableReveal((prev) => {
        const next = { ...prev };
        const r = { ...next[c.id] };
        if (field === "username") delete r.username;
        else delete r.password;
        if (r.username === undefined && r.password === undefined) delete next[c.id];
        else next[c.id] = r;
        return next;
      });
      return;
    }
    const busyKey = `${c.id}-${field}`;
    setTableRevealBusyKey(busyKey);
    void credentialsApi
      .get(c.id, true)
      .then((d) => {
        const value = field === "username" ? (d.username ?? "") : (d.password ?? "");
        // Only one of username or password may be visible per row at a time
        setTableReveal((prev) => ({
          ...prev,
          [c.id]: field === "username" ? { username: value } : { password: value },
        }));
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Could not load");
      })
      .finally(() => setTableRevealBusyKey(null));
  };

  const openShare = async (credId: string) => {
    setShareCredId(credId);
    setSharesList([]);
    setShareExpiry("");
    setShareDefaultExpiryMode("forever");
    setShareUserSearch("");
    setDebouncedShareSearch("");
    setShareSelectedUserIds([]);
    setRowExpiryDraft({});
    setShareOpen(true);
    setShareListLoading(true);
    try {
      const { shares } = await credentialsApi.listShares(credId);
      setSharesList(shares);
    } catch {
      setSharesList([]);
    } finally {
      setShareListLoading(false);
    }
  };

  const addSelectedUsersToShare = async () => {
    if (!shareCredId || shareSelectedUserIds.length === 0) return;
    if (shareDefaultExpiryMode === "custom") {
      const raw = shareExpiry.trim();
      if (!raw) {
        toast.error("Choose an expiry date and time, or select Forever.");
        return;
      }
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        toast.error("Invalid expiry date.");
        return;
      }
    }
    const count = shareSelectedUserIds.length;
    setShareBulkAdding(true);
    try {
      const { shares } = await credentialsApi.addShares(shareCredId, {
        userIds: shareSelectedUserIds,
        includeGlobalAdmins: false,
        includeCredentialAdmins: false,
        ...(shareDefaultExpiryMode === "custom" && shareExpiry.trim()
          ? { expiryDatetime: new Date(shareExpiry).toISOString() }
          : {}),
      });
      setSharesList(shares);
      setShareSelectedUserIds([]);
      toast.success(count === 1 ? "Shared with 1 user" : `Shared with ${count} users`);
      loadList();
      setShareOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not share");
    } finally {
      setShareBulkAdding(false);
    }
  };

  const toggleShareUserSelected = (userId: string) => {
    setShareSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const saveShareRowExpiry = async (s: CredentialShareDto) => {
    if (!shareCredId) return;
    const raw = rowExpiryDraft[s.id] ?? isoToDatetimeLocal(s.expiryDatetime);
    const iso = datetimeLocalToIso(raw);
    setShareExpirySavingShareId(s.id);
    try {
      const { shares } = await credentialsApi.addShares(shareCredId, {
        userIds: [s.sharedWith.id],
        includeGlobalAdmins: false,
        includeCredentialAdmins: false,
        ...(iso ? { expiryDatetime: iso } : {}),
      });
      setSharesList(shares);
      setRowExpiryDraft((prev) => {
        const next = { ...prev };
        delete next[s.id];
        return next;
      });
      toast.success("Access expiry updated");
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update expiry");
    } finally {
      setShareExpirySavingShareId(null);
    }
  };

  const makeShareForever = async (s: CredentialShareDto) => {
    if (!shareCredId) return;
    setShareExpirySavingShareId(s.id);
    try {
      const { shares } = await credentialsApi.addShares(shareCredId, {
        userIds: [s.sharedWith.id],
        includeGlobalAdmins: false,
        includeCredentialAdmins: false,
      });
      setSharesList(shares);
      setRowExpiryDraft((prev) => {
        const next = { ...prev };
        delete next[s.id];
        return next;
      });
      toast.success("Access set to forever");
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update access");
    } finally {
      setShareExpirySavingShareId(null);
    }
  };

  const revokeShare = async (shareId: string) => {
    if (!shareCredId) return;
    setShareRevokingShareId(shareId);
    try {
      await credentialsApi.revokeShare(shareCredId, shareId);
      setSharesList((prev) => prev.filter((s) => s.id !== shareId));
      toast.success("Share cancelled — they no longer have access.");
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel share");
    } finally {
      setShareRevokingShareId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await credentialsApi.delete(deleteId);
      toast.success("Credential deleted");
      setDeleteId(null);
      setDetail(null);
      setDetailEyeBusyField(null);
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const canEdit = (c: CredentialSummaryDto) =>
    c.accessLevel === "owner" || c.accessLevel === "admin";

  const shareUsersPick = useMemo(
    () => users.filter((u) => u.id !== user?.id),
    [users, user?.id],
  );

  const userProfilePictureById = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    for (const u of users) {
      if (u.profilePicture) m[u.id] = u.profilePicture;
    }
    return m;
  }, [users]);

  const sharedUserIds = useMemo(() => new Set(sharesList.map((s) => s.sharedWith.id)), [sharesList]);

  const availableUsersForShare = useMemo(() => {
    const q = debouncedShareSearch.toLowerCase();
    return shareUsersPick.filter((u) => {
      if (sharedUserIds.has(u.id)) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [shareUsersPick, sharedUserIds, debouncedShareSearch]);

  /** Drop selections only when a user is no longer shareable (already shared or removed from directory), not when search changes. */
  useEffect(() => {
    const valid = new Set(shareUsersPick.map((u) => u.id));
    setShareSelectedUserIds((prev) =>
      prev.filter((id) => valid.has(id) && !sharedUserIds.has(id)),
    );
  }, [shareUsersPick, sharedUserIds]);

  const selectAllAvailableShareUsers = () => {
    setShareSelectedUserIds((prev) => {
      const next = new Set(prev);
      for (const u of availableUsersForShare) next.add(u.id);
      return Array.from(next);
    });
  };

  const clearShareUserSelection = () => {
    setShareSelectedUserIds([]);
  };

  const renderCredentialsTable = (tabKey: TabKey) => (
    <div className={cn("flex min-h-0 flex-1 flex-col", credTableShell)}>
      {!loading &&
        items.length > 0 &&
        (tabKey === "mine" || tabKey === "all") &&
        items.some((c) => c.hasExpiredShares) && (
          <div
            className="flex shrink-0 items-start gap-2.5 border-b border-amber-200/90 bg-amber-50 px-4 py-2.5 text-[13px] font-medium leading-snug text-amber-950 dark:border-amber-500/25 dark:bg-amber-950/35 dark:text-amber-50"
            role="status"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              Some shared access has expired. Highlighted rows need attention — open{" "}
              <span className="font-semibold">Share</span> to renew or set forever access.
            </span>
          </div>
        )}
      {loading ? (
        <Loader message="Loading…" className="min-h-[200px] py-16 text-muted-foreground" />
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-border/50">
            <KeyRound className="h-8 w-8 text-muted-foreground/70" />
          </div>
          <p className="text-base font-semibold tracking-tight text-foreground">No credentials here</p>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Create one or switch tabs to see shared items.
          </p>
        </div>
      ) : (
        <Table maxHeight="calc(100dvh - 15.5rem)" className="w-full min-w-0 table-fixed border-collapse text-[13px]">
          <colgroup>
            <col className={tabKey === "shared" ? credTableColDataEqual : credTableColData} />
            <col className={tabKey === "shared" ? credTableColDataEqual : credTableColData} />
            <col className={tabKey === "shared" ? credTableColDataEqual : credTableColData} />
            <col className={tabKey === "shared" ? credTableColDataEqual : credTableColData} />
            <col className={tabKey === "shared" ? credTableColDataEqual : credTableColData} />
            <col className={tabKey === "shared" ? credTableColDataEqual : credTableColData} />
            {tabKey !== "shared" ? <col className={credTableColActions} /> : null}
          </colgroup>
          <TableHeader className={credTableHeaderClass}>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="min-w-0">Title</TableHead>
              <TableHead className="min-w-0">URL</TableHead>
              <TableHead className="min-w-0">Username</TableHead>
              <TableHead className="min-w-0">Password</TableHead>
              <TableHead className="min-w-0 text-center">Note</TableHead>
              <TableHead className={cn("min-w-0", tabKey === "shared" ? "text-left" : "text-center")}>
                {tabKey === "shared" ? (
                  <span className="inline-flex items-center justify-start gap-1.5">
                    <User className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    Owner
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Users className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    Shared
                  </span>
                )}
              </TableHead>
              {tabKey !== "shared" ? (
                <TableHead className="w-16 min-w-0 !px-1 !py-3 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => {
              const userKey = `${c.id}-username`;
              const passKey = `${c.id}-password`;
              const userBusy = tableRevealBusyKey === userKey || tableCopyBusyKey === userKey;
              const passBusy = tableRevealBusyKey === passKey || tableCopyBusyKey === passKey;
              const hasSharedUsers =
                (c.sharePreview && c.sharePreview.length > 0) ||
                (typeof c.sharesCount === "number" && c.sharesCount > 0);
              return (
                <TableRow
                  key={c.id}
                  className={cn(
                    "cursor-pointer",
                    credTableRowClass,
                    c.hasExpiredShares &&
                      "border-l-[3px] border-l-amber-500 bg-amber-50/50 dark:border-l-amber-500 dark:bg-amber-950/30",
                  )}
                  aria-label={c.hasExpiredShares ? "Credential has expired shares" : undefined}
                  onClick={() => {
                    if (tabKey === "shared" && c.isExpired) {
                      toast.error("This share has expired");
                      return;
                    }
                    void openDetail(c.id);
                  }}
                >
                  <TableCell
                    className="min-w-0 px-3 py-2.5 pl-4 align-middle"
                    title={c.hasExpiredShares ? (c.ownerWarningMessage ?? c.title) : c.title}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      {c.hasExpiredShares ? (
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500"
                          aria-hidden
                        />
                      ) : null}
                      <span className="line-clamp-2 font-semibold leading-snug tracking-tight text-foreground">{c.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-0 overflow-hidden px-3 py-2.5 align-middle text-muted-foreground">
                    {c.url ? (
                      <div className="min-w-0 w-full">
                        {isNavigableHttpUrl(c.url) ? (
                          <a
                            href={c.url.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block min-w-0 truncate text-left text-[13px] font-medium text-indigo-600 underline decoration-indigo-300/50 underline-offset-2 hover:text-indigo-700 dark:text-indigo-400 dark:decoration-indigo-500/40 dark:hover:text-indigo-300"
                            title={c.url}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {c.url.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          <span
                            className="block min-w-0 truncate text-left text-[13px] font-medium text-foreground/90"
                            title={c.url}
                          >
                            {c.url}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-0 px-3 py-2 align-middle">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="min-w-0 flex-1 truncate rounded-md bg-muted/30 px-2 py-1.5 font-mono text-[12px] leading-tight text-foreground ring-1 ring-border/30 dark:bg-muted/20"
                        title={
                          tableReveal[c.id]?.username !== undefined
                            ? tableReveal[c.id]!.username
                            : credentialUsernameCollapsedLabel(c)
                        }
                      >
                        {tableReveal[c.id]?.username !== undefined
                          ? tableReveal[c.id]!.username
                          : credentialUsernameCollapsedLabel(c)}
                      </span>
                      <div className={credIconGroup}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-background/90 hover:text-foreground"
                          title={tableReveal[c.id]?.username !== undefined ? "Hide username" : "Show username"}
                          disabled={userBusy}
                          onClick={(e) => toggleTableFieldReveal(e, c, tabKey, "username")}
                        >
                          {tableRevealBusyKey === userKey ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : tableReveal[c.id]?.username !== undefined ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-background/90 hover:text-foreground"
                          title="Copy username"
                          disabled={userBusy}
                          onClick={(e) => void copyTableField(e, c, tabKey, "username")}
                        >
                          {tableCopyBusyKey === userKey ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-0 px-3 py-2 align-middle">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate rounded-md bg-muted/30 px-2 py-1.5 font-mono text-[12px] leading-tight text-muted-foreground ring-1 ring-border/30 dark:bg-muted/20">
                        {tableReveal[c.id]?.password !== undefined ? tableReveal[c.id]!.password : c.passwordMasked || maskSecret()}
                      </span>
                      <div className={credIconGroup}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-background/90 hover:text-foreground"
                          title={tableReveal[c.id]?.password !== undefined ? "Hide password" : "Show password"}
                          disabled={passBusy}
                          onClick={(e) => toggleTableFieldReveal(e, c, tabKey, "password")}
                        >
                          {tableRevealBusyKey === passKey ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : tableReveal[c.id]?.password !== undefined ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-background/90 hover:text-foreground"
                          title="Copy password"
                          disabled={passBusy}
                          onClick={(e) => void copyTableField(e, c, tabKey, "password")}
                        >
                          {tableCopyBusyKey === passKey ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-0 px-3 py-2.5 align-middle text-center text-muted-foreground">
                    {(c.note || c.description)?.trim() ? (
                      <span
                        className="line-clamp-2 break-words text-center text-[13px] leading-snug text-foreground/90"
                        title={(c.note || c.description)?.trim()}
                      >
                        {(c.note || c.description)?.trim()}
                      </span>
                    ) : (
                      <span className="block text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "min-w-0 px-3 py-2.5 align-middle",
                      tabKey === "shared" ? "text-left" : "text-center",
                      tabKey !== "shared" && canEdit(c) && "cursor-pointer rounded-md transition-colors hover:bg-muted/40",
                    )}
                    title={tabKey !== "shared" && canEdit(c) ? "Share credential" : undefined}
                    onClick={(e) => {
                      if (tabKey === "shared") return;
                      if (!canEdit(c)) return;
                      e.stopPropagation();
                      void openShare(c.id);
                    }}
                  >
                    {tabKey === "shared" ? (
                      <div className="flex min-h-[2.75rem] items-center justify-start gap-2.5 py-0.5">
                        <ShareModalUserAvatar
                          className="h-8 w-8"
                          name={c.ownerName?.trim() ? c.ownerName : "?"}
                          src={c.ownerProfilePicture}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate font-medium leading-snug text-foreground"
                            title={c.ownerName?.trim() ? c.ownerName : undefined}
                          >
                            {c.ownerName?.trim() ? c.ownerName : "—"}
                          </p>
                          <p
                            className="truncate text-xs leading-snug text-muted-foreground"
                            title={c.ownerEmail?.trim() ? c.ownerEmail : undefined}
                          >
                            {c.ownerEmail?.trim() ? c.ownerEmail : "—"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-[1.75rem] items-center justify-center gap-1.5">
                        {c.sharePreview && c.sharePreview.length > 0 ? (
                          <ShareRecipientsStack recipients={c.sharePreview} />
                        ) : hasSharedUsers ? (
                          <span
                            className="inline-flex items-center justify-center gap-1 text-muted-foreground"
                            title={`Shared with ${typeof c.sharesCount === "number" ? c.sharesCount : "some"} recipient(s)`}
                          >
                            <Users className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                            {typeof c.sharesCount === "number" && c.sharesCount > 0 ? (
                              <span className="text-xs font-medium tabular-nums">{c.sharesCount}</span>
                            ) : null}
                          </span>
                        ) : null}
                        {canEdit(c) && !hasSharedUsers && (
                          <Share2 className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
                        )}
                      </div>
                    )}
                  </TableCell>
                  {tabKey !== "shared" ? (
                    <TableCell
                      className="w-16 min-w-0 px-1 py-2 pr-2 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={credRowMenuTriggerClass}
                            >
                              <MoreVertical className="h-4 w-4" strokeWidth={2.25} />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={6} className={credRowMenuContentClass}>
                            {!canEdit(c) && (
                              <DropdownMenuItem className={credRowMenuItemClass} onClick={() => void openDetail(c.id)}>
                                <Eye className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                                View
                              </DropdownMenuItem>
                            )}
                            {canEdit(c) && (
                              <>
                                <DropdownMenuItem className={credRowMenuItemClass} onClick={() => void openEdit(c)}>
                                  <Pencil className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className={credRowMenuItemClass} onClick={() => openShare(c.id)}>
                                  <Share2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className={credRowMenuSeparatorClass} />
                                <DropdownMenuItem
                                  className={credRowMenuItemDestructiveClass}
                                  onClick={() => setDeleteId(c.id)}
                                >
                                  <Trash2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
        <div className="shrink-0 rounded-2xl border border-border/80 bg-card p-4 shadow-sm dark:border-border/55 dark:shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-x-4 md:gap-y-3">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as TabKey)}
              className="min-w-0 w-full shrink-0 md:w-auto md:max-w-[min(100%,44rem)]"
            >
              <TabsList className={credVaultTabsListClass}>
                <TabsTrigger value="mine" className={credVaultTabsTriggerClass}>
                  <KeyRound className={credVaultTabIconClass} aria-hidden />
                  <span className="whitespace-nowrap">My credentials</span>
                </TabsTrigger>
                <TabsTrigger value="shared" className={credVaultTabsTriggerClass}>
                  <Users className={credVaultTabIconClass} aria-hidden />
                  <span className="whitespace-nowrap">Shared with me</span>
                </TabsTrigger>
                {credAdmin ? (
                  <TabsTrigger value="all" className={credVaultTabsTriggerClass}>
                    <Shield className={credVaultTabIconClass} aria-hidden />
                    <span className="whitespace-nowrap">All (admin)</span>
                  </TabsTrigger>
                ) : null}
              </TabsList>
              <TabsContent value="mine" className="hidden" tabIndex={-1} aria-hidden />
              <TabsContent value="shared" className="hidden" tabIndex={-1} aria-hidden />
              {credAdmin ? <TabsContent value="all" className="hidden" tabIndex={-1} aria-hidden /> : null}
            </Tabs>
            <div className="flex min-w-0 w-full flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 md:min-w-[min(100%,20rem)] md:justify-end">
              <div className="relative min-w-0 flex-1 md:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search title, URL, note…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <Button
                type="button"
                onClick={openCreate}
                className="h-9 shrink-0 gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white hover:from-indigo-500 hover:to-violet-500"
              >
                <Plus className="h-4 w-4" />
                New credential
              </Button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{renderCredentialsTable(tab)}</div>
      </div>

      {/* Create / Edit */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && formSaving) return;
          setFormOpen(open);
        }}
      >
        <DialogContent className={cn(credFormModalClass, "w-[calc(100vw-1.5rem)] max-w-3xl")}>
          <div className={credFormHeaderClass}>
            <DialogHeader className="space-y-0 text-left">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 ring-1 ring-indigo-500/25 dark:bg-indigo-400/15 dark:ring-indigo-400/25"
                  aria-hidden
                >
                  <KeyRound className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                  <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                    {editingId ? "Edit credential" : "New credential"}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    {editingId ? "Edit stored credential" : "Add a new credential to the vault"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="space-y-3 px-6 py-3">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 sm:items-start">
              <div className="min-w-0">
                <Label className={credFormLabelClass}>
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={credFormFieldClass}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="min-w-0">
                <Label className={credFormLabelClass}>URL</Label>
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className={credFormFieldClass}
                  placeholder="https://example.com/app"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="min-w-0">
                <Label className={credFormLabelClass}>
                  Username <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={credFormFieldClass}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="min-w-0">
                <Label className={credFormLabelClass}>
                  Password <span className="text-destructive">*</span>
                </Label>
                <div className="flex w-full min-w-0 flex-nowrap items-center justify-center gap-1.5">
                  <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
                    <Input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(credFormFieldClass, "min-w-0 flex-1 font-mono")}
                      placeholder={editingId ? "••••••••" : ""}
                      autoComplete="new-password"
                      spellCheck={false}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-lg border-border/90 bg-background text-foreground shadow-sm transition-colors hover:border-indigo-500/40 hover:bg-muted/50 dark:border-border dark:bg-muted/25"
                      onClick={() => setPassword(generateSecurePassword(15))}
                      title="Generate random password"
                      aria-label="Generate random password"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg border-border/90 bg-background text-foreground shadow-sm hover:border-border/90 hover:bg-background hover:text-foreground dark:border-border dark:bg-muted/25 dark:hover:bg-muted/25 dark:hover:text-foreground"
                    disabled={!password.trim()}
                    onClick={() => void copyPassword(password, "Password copied")}
                    title="Copy password"
                    aria-label="Copy password"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-1.5 space-y-1">
                  <div
                    className="flex gap-1"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={6}
                    aria-valuenow={password.length ? passwordStrength.score : 0}
                    aria-label="Password strength"
                  >
                    {[0, 1, 2, 3, 4, 5].map((i) => {
                      const filled = password.length > 0 && i < passwordStrength.score;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "h-2 min-w-0 flex-1 rounded-sm transition-colors",
                            filled ? strengthBlockClass(passwordStrength.score) : "bg-muted/80 dark:bg-muted/50"
                          )}
                        />
                      );
                    })}
                  </div>
                  <p className="min-h-[0.875rem] text-[11px] font-medium leading-tight text-foreground/70 dark:text-foreground/60">
                    {password.length === 0 ? "" : passwordStrength.label}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <Label className={credFormLabelClass}>Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} className={credFormAreaClass} rows={2} />
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border/70 bg-muted/30 px-6 py-3 dark:bg-muted/15 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-xl border-border/80 bg-background shadow-sm hover:bg-muted/60"
              disabled={formSaving}
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold text-white shadow-md ring-1 ring-indigo-500/30 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 dark:ring-indigo-400/20"
              disabled={!canSaveCredential || formSaving}
              aria-busy={formSaving}
              onClick={() => void saveCredential()}
            >
              {formSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog
        open={!!detail || detailLoading}
        onOpenChange={(o) => {
          if (!o) {
            setDetail(null);
            setDetailRevealField(null);
            setDetailEyeBusyField(null);
            setDetailLoading(false);
          }
        }}
      >
        <DialogContent showClose={false} className={detailModalShell}>
          <div className="shrink-0 border-b border-border/60 bg-gradient-to-r from-indigo-500/[0.08] via-violet-500/[0.04] to-transparent px-6 py-4 dark:from-indigo-500/15 dark:via-violet-500/10">
            <DialogHeader className="space-y-0 text-left">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 ring-1 ring-indigo-500/25 dark:bg-indigo-500/20 dark:ring-indigo-400/25"
                  aria-hidden
                >
                  <KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1 basis-[min(100%,14rem)]">
                      <DialogTitle className="truncate text-lg font-semibold tracking-tight text-foreground">
                        {detail?.title ?? (detailLoading ? "Loading…" : "Credential")}
                      </DialogTitle>
                    </div>
                    {detail ? (
                      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 border-border/50 sm:border-l sm:pl-3 dark:border-border/50 lg:pl-4">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Owner
                        </span>
                        <ShareModalUserAvatar
                          className="h-8 w-8 sm:h-9 sm:w-9"
                          name={detail.ownerName?.trim() ? detail.ownerName : "?"}
                          src={detail.ownerProfilePicture}
                        />
                        <div className="min-w-0 max-w-[12rem] sm:max-w-[14rem]">
                          <p className="truncate text-sm font-semibold leading-tight text-foreground">
                            {detail.ownerName?.trim() ? detail.ownerName : "—"}
                          </p>
                          {detail.ownerEmail?.trim() ? (
                            <p className="truncate text-xs text-muted-foreground" title={detail.ownerEmail}>
                              {detail.ownerEmail}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <DialogDescription className="sr-only">Credential details</DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {detailLoading && !detail ? (
            <div className="flex flex-col items-center justify-center px-6 py-12">
              <Loader message="Loading credential…" className="text-muted-foreground" />
            </div>
          ) : detail ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="grid min-h-0 flex-1 gap-6 overflow-hidden p-4 sm:p-6 lg:grid-cols-2 lg:items-stretch lg:gap-6">
                  <section className="flex h-full min-h-0 w-full flex-col overflow-y-auto rounded-xl border border-indigo-500/25 bg-muted/15 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-muted/10">
                    <h3 className="text-sm font-semibold text-foreground">Account & secrets</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Username, password, website URL, and your note.
                    </p>

                    {detail.hasExpiredShares ? (
                      <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2.5 text-[13px] font-medium leading-snug text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-50">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                        <span>
                          {detail.ownerWarningMessage ??
                            "Some shared access has expired. Update the secret and open Share to renew or set forever access."}
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-1 flex-col space-y-4 text-[15px] text-foreground">
                      <div>
                        <span className={labelClassModal}>Username</span>
                        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                          <p className="min-h-[2.75rem] flex-1 break-all rounded-lg border border-border/80 bg-background/90 px-3 py-2.5 font-mono text-[15px] leading-relaxed shadow-sm dark:bg-muted/30">
                            {detailRevealField === "username"
                              ? (detail.username ?? "")
                              : credentialUsernameCollapsedLabel(detail)}
                          </p>
                          <div className="flex w-full shrink-0 items-center justify-center gap-1 sm:w-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-0"
                              aria-label={detailRevealField === "username" ? "Hide username" : "Show username"}
                              title={detailRevealField === "username" ? "Hide username" : "Show username"}
                              disabled={detailLoading}
                              onClick={() => void revealDetailField("username")}
                            >
                              {detailLoading &&
                              (detailEyeBusyField === "username" || detailEyeBusyField === "both") ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : detailRevealField === "username" ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-0"
                              aria-label="Copy username"
                              title="Copy username"
                              disabled={detailLoading}
                              onClick={() => void copyDetailUsername()}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className={labelClassModal}>Password</span>
                        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                          <code className="block min-h-[2.75rem] flex-1 break-all rounded-lg border border-border/80 bg-background/90 px-3 py-2.5 font-mono text-[15px] leading-relaxed shadow-sm dark:bg-muted/30">
                            {detailRevealField === "password" ? (detail.password ?? "") : detail.passwordMasked || maskSecret()}
                          </code>
                          <div className="flex w-full shrink-0 items-center justify-center gap-1 sm:w-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-0"
                              aria-label={detailRevealField === "password" ? "Hide password" : "Show password"}
                              title={detailRevealField === "password" ? "Hide password" : "Show password"}
                              disabled={detailLoading}
                              onClick={() => void revealDetailField("password")}
                            >
                              {detailLoading &&
                              (detailEyeBusyField === "password" || detailEyeBusyField === "both") ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : detailRevealField === "password" ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-0"
                              aria-label="Copy password"
                              title="Copy password"
                              disabled={detailLoading}
                              onClick={() => void copyDetailPassword()}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className={labelClassModal}>URL</span>
                        {detail.url ? (
                          <p className="mt-1.5 break-all rounded-lg border border-border/80 bg-background/90 px-3 py-2.5 text-[15px] shadow-sm dark:bg-muted/30">
                            {isNavigableHttpUrl(detail.url) ? (
                              <a
                                href={detail.url.trim()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-indigo-600 underline decoration-indigo-300/60 underline-offset-2 hover:text-indigo-700 dark:text-indigo-400"
                              >
                                {detail.url}
                              </a>
                            ) : (
                              <span className="font-medium text-foreground">{detail.url}</span>
                            )}
                          </p>
                        ) : (
                          <p className="mt-1.5 rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
                            —
                          </p>
                        )}
                      </div>
                      <div>
                        <span className={labelClassModal}>Note</span>
                        <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-border/80 bg-background/90 px-3 py-2.5 text-[15px] leading-relaxed text-foreground/90 shadow-sm dark:bg-muted/30">
                          {(detail.note || detail.description)?.trim() ? detail.note || detail.description : "—"}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/95 via-slate-50/90 to-slate-100/80 p-4 shadow-sm ring-1 ring-emerald-500/15 dark:border-emerald-500/30 dark:from-emerald-950/35 dark:via-slate-950/60 dark:to-slate-950 dark:ring-emerald-400/10">
                    <div className="shrink-0">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md dark:bg-emerald-500">
                          <Users className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-foreground">
                            Access & metadata
                          </h3>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-muted-foreground">
                            Activity and who this credential is shared with.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200/90 bg-white/95 p-3.5 shadow-sm dark:border-border/80 dark:bg-slate-900/85">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                            <span className={labelClassModal}>Created</span>
                          </div>
                          <p className="mt-2 text-[15px] font-medium tabular-nums text-slate-900 dark:text-foreground">
                            {formatCredentialDetailDate(detail.createdAt)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200/90 bg-white/95 p-3.5 shadow-sm dark:border-border/80 dark:bg-slate-900/85">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                            <span className={labelClassModal}>Last updated</span>
                          </div>
                          <p className="mt-2 text-[15px] font-medium tabular-nums text-slate-900 dark:text-foreground">
                            {formatCredentialDetailDate(detail.updatedAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-2">
                      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-emerald-200/70 bg-white/90 p-3.5 shadow-sm dark:border-emerald-500/25 dark:bg-emerald-950/25">
                        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <div className="flex min-w-0 items-center gap-2 text-slate-500 dark:text-muted-foreground">
                            <Users className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                            <span className={labelClassModal}>People with access</span>
                          </div>
                          <span className="inline-flex shrink-0 items-center rounded-md bg-emerald-100 px-2 py-0.5 text-sm font-semibold text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-100">
                            {typeof detail.sharesCount === "number" ? (
                              <>
                                {detail.sharesCount} share{detail.sharesCount === 1 ? "" : "s"}
                              </>
                            ) : (
                              "—"
                            )}
                          </span>
                        </div>
                        <div className="mt-3 flex min-h-0 flex-1 flex-col">
                          {detail.sharePreview && detail.sharePreview.length > 0 ? (
                            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-2.5 dark:border-emerald-500/20 dark:bg-emerald-950/30">
                              <div className="flex flex-wrap content-start gap-2">
                                {detail.sharePreview.map((r, i) => (
                                  <span
                                    key={`${r.name}-${i}`}
                                    className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg border border-emerald-200/90 bg-white/95 py-1.5 pl-1.5 pr-2.5 text-[13px] font-medium leading-snug text-slate-900 shadow-sm dark:border-emerald-500/35 dark:bg-emerald-950/50 dark:text-emerald-50"
                                    title={r.name}
                                  >
                                    <ShareModalUserAvatar
                                      className="h-8 w-8"
                                      name={r.name}
                                      src={r.profilePicture}
                                    />
                                    <span className="min-w-0 break-words">{r.name}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-emerald-200/50 bg-emerald-50/30 px-3 py-8 text-center dark:border-emerald-500/20 dark:bg-emerald-950/20">
                              <p className="text-sm text-muted-foreground">No other users have access.</p>
                            </div>
                          )}
                        </div>
                      </div>
                      {(detail.accessLevel === "owner" || detail.accessLevel === "admin") && (
                        <Button
                          size="sm"
                          className="w-full shrink-0 self-start rounded-xl border border-emerald-200 bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-500 dark:border-emerald-500/40 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:w-auto"
                          onClick={() => {
                            setDetail(null);
                            setDetailRevealField(null);
                            setDetailEyeBusyField(null);
                            void openShare(detail.id);
                          }}
                        >
                          <Share2 className="mr-2 h-4 w-4" />
                          Manage shares
                        </Button>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              <DialogFooter className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 dark:bg-muted/10">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setDetail(null);
                    setDetailRevealField(null);
                    setDetailEyeBusyField(null);
                    setDetailLoading(false);
                  }}
                >
                  Close
                </Button>
                {canEdit(detail) ? (
                  <Button
                    className="rounded-xl gap-2 bg-indigo-600 font-semibold text-white hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                    onClick={handleOpenEditFromDetail}
                  >
                    <KeyRound className="h-4 w-4" />
                    Edit credential
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Share */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className={shareModalShell}>
          <div className="shrink-0 border-b border-border/60 bg-gradient-to-r from-indigo-500/[0.08] via-violet-500/[0.04] to-transparent px-6 py-4 dark:from-indigo-500/15 dark:via-violet-500/10">
            <DialogHeader className="space-y-0 text-left">
              <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">Share credential</DialogTitle>
              <DialogDescription className="sr-only">Choose users to share this credential with.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:h-full lg:flex-row lg:items-stretch lg:overflow-hidden lg:pb-6">
                <section className="flex w-full flex-col rounded-xl border border-indigo-500/25 bg-muted/15 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-muted/10 lg:h-full lg:min-h-0 lg:w-1/2 lg:max-w-[50%]">
                  <h3 className="text-sm font-semibold text-foreground">Share with users</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose who should receive access. Pick default expiry (Forever or Custom), then select people and press{" "}
                    <span className="font-medium text-foreground">Share</span> in the footer.
                  </p>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-border dark:bg-muted/20">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-muted-foreground">
                        Expiration
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-muted-foreground/80">New shares only</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={shareDefaultExpiryMode === "forever"}
                        onClick={() => {
                          setShareDefaultExpiryMode("forever");
                          setShareExpiry("");
                        }}
                        className={cn(
                          "flex min-h-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-1",
                          shareDefaultExpiryMode === "forever"
                            ? "border-indigo-600 bg-indigo-50/90 dark:border-indigo-500 dark:bg-indigo-500/15"
                            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-border dark:bg-card dark:hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2",
                            shareDefaultExpiryMode === "forever"
                              ? "border-indigo-600 dark:border-indigo-400"
                              : "border-slate-300 dark:border-muted-foreground/40",
                          )}
                          aria-hidden
                        >
                          {shareDefaultExpiryMode === "forever" ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                          ) : null}
                        </span>
                        <Infinity
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            shareDefaultExpiryMode === "forever"
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-slate-400 dark:text-muted-foreground",
                          )}
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            "min-w-0 truncate text-xs font-semibold",
                            shareDefaultExpiryMode === "forever"
                              ? "text-indigo-700 dark:text-indigo-300"
                              : "text-slate-800 dark:text-foreground",
                          )}
                        >
                          Forever
                        </span>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={shareDefaultExpiryMode === "custom"}
                        onClick={() => setShareDefaultExpiryMode("custom")}
                        className={cn(
                          "flex min-h-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-1",
                          shareDefaultExpiryMode === "custom"
                            ? "border-indigo-600 bg-indigo-50/90 dark:border-indigo-500 dark:bg-indigo-500/15"
                            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-border dark:bg-card dark:hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2",
                            shareDefaultExpiryMode === "custom"
                              ? "border-indigo-600 dark:border-indigo-400"
                              : "border-slate-300 dark:border-muted-foreground/40",
                          )}
                          aria-hidden
                        >
                          {shareDefaultExpiryMode === "custom" ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                          ) : null}
                        </span>
                        <Calendar
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            shareDefaultExpiryMode === "custom"
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-slate-400 dark:text-muted-foreground",
                          )}
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            "min-w-0 truncate text-xs font-semibold",
                            shareDefaultExpiryMode === "custom"
                              ? "text-indigo-700 dark:text-indigo-300"
                              : "text-slate-800 dark:text-foreground",
                          )}
                        >
                          Custom
                        </span>
                      </button>
                    </div>
                    {shareDefaultExpiryMode === "custom" ? (
                      <div className="mt-2 border-t border-slate-100 pt-2 dark:border-border/60">
                        <Label htmlFor="share-exp-datetime" className="sr-only">
                          Expires at
                        </Label>
                        <Input
                          id="share-exp-datetime"
                          type="datetime-local"
                          value={shareExpiry}
                          onChange={(e) => setShareExpiry(e.target.value)}
                          className="h-9 w-full max-w-[18rem] rounded-md border-slate-200 bg-white text-xs shadow-sm dark:border-border dark:bg-background"
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap items-start justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Select users</span>
                    {availableUsersForShare.length > 0 && !shareListLoading ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          onClick={selectAllAvailableShareUsers}
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          onClick={clearShareUserSelection}
                          disabled={shareSelectedUserIds.length === 0}
                        >
                          Clear
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email…"
                      value={shareUserSearch}
                      onChange={(e) => setShareUserSearch(e.target.value)}
                      className="h-10 rounded-lg border-border/80 bg-background pl-9 text-sm shadow-sm"
                    />
                  </div>
                  <div className="mt-2 h-[min(320px,40vh)] min-h-[240px] shrink-0 overflow-y-auto overscroll-contain rounded-lg border border-border/50 bg-background/60 p-1 dark:bg-background/40">
                    {shareListLoading ? (
                      <div className="space-y-2 p-2">
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                      </div>
                    ) : availableUsersForShare.length === 0 ? (
                      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                        {debouncedShareSearch
                          ? "No users found."
                          : "Everyone eligible already has access, or there are no other users."}
                      </div>
                    ) : (
                      <ul className="space-y-0.5">
                        {availableUsersForShare.map((u) => {
                          const checked = shareSelectedUserIds.includes(u.id);
                          return (
                            <li key={u.id}>
                              <div
                                role="button"
                                tabIndex={0}
                                className={cn(
                                  "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50",
                                  checked && "bg-indigo-500/[0.06] dark:bg-indigo-500/10",
                                )}
                                onClick={() => toggleShareUserSelected(u.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    toggleShareUserSelected(u.id);
                                  }
                                }}
                              >
                                <div
                                  className="flex shrink-0 items-center"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleShareUserSelected(u.id)}
                                    className="shrink-0"
                                    aria-label={`Select ${u.name}`}
                                  />
                                </div>
                                <ShareModalUserAvatar
                                  name={u.name}
                                  src={u.profilePicture || undefined}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-foreground">{u.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {shareSelectedUserIds.length === 0
                      ? "Select one or more people, then use Share in the footer."
                      : shareDefaultExpiryMode === "forever"
                        ? `${shareSelectedUserIds.length} selected — Forever access when you Share.`
                        : `${shareSelectedUserIds.length} selected — Custom expiry applies when you Share.`}
                  </p>
                </section>

                <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-emerald-500/25 bg-muted/15 p-4 shadow-sm dark:border-emerald-500/20 dark:bg-muted/10 lg:h-full lg:min-h-0 lg:flex-1">
                  <h3 className="shrink-0 text-sm font-semibold text-foreground">People with access</h3>
                  <p className="mt-1 shrink-0 text-xs text-muted-foreground">
                    People who can open this credential today. Update access below or{" "}
                    <span className="font-medium text-foreground">Cancel share</span> to remove access.
                  </p>
                  {shareListLoading ? (
                    <div className="mt-3 min-h-0 flex-1 space-y-2">
                      <Skeleton className="h-16 w-full rounded-lg" />
                      <Skeleton className="h-16 w-full rounded-lg" />
                      <Skeleton className="h-16 w-full rounded-lg" />
                    </div>
                  ) : sharesList.length === 0 ? (
                    <div className="mt-3 flex min-h-0 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground dark:bg-background/20">
                      <p>
                        No one has access yet. Grant access from <span className="font-medium text-foreground">Share with users</span>{" "}
                        (above on small screens, left column on wide layouts).
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
                      {sharesList.map((s) => {
                        const pic = userProfilePictureById[s.sharedWith.id];
                        const revoking = shareRevokingShareId === s.id;
                        const savingExp = shareExpirySavingShareId === s.id;
                        return (
                          <li
                            key={s.id}
                            className={cn(
                              "rounded-lg border border-border/50 bg-background p-2.5 shadow-sm dark:bg-background/80 sm:p-3",
                              s.isExpired && "opacity-75",
                            )}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                              <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
                                <div className="shrink-0 pt-0.5">
                                  <ShareModalUserAvatar name={s.sharedWith.name} src={pic} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={cn(
                                      "truncate text-sm font-semibold text-foreground",
                                      s.isExpired && "text-muted-foreground line-through",
                                    )}
                                  >
                                    {s.sharedWith.name}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">{s.sharedWith.email}</p>
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {s.shareNeverExpires || !s.expiryDatetime ? (
                                      <Badge
                                        variant="outline"
                                        className="shrink-0 border-emerald-200/70 bg-emerald-50 text-[11px] font-semibold text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
                                      >
                                        Forever
                                      </Badge>
                                    ) : s.isExpired ? (
                                      <Badge variant="destructive" className="shrink-0 text-[11px] font-semibold">
                                        Expired
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="secondary"
                                        className="max-w-[min(100%,18rem)] whitespace-normal px-2 py-0 text-left text-[11px] font-medium leading-snug"
                                        title={formatShareExpiryChipLabel(s.expiryDatetime)}
                                      >
                                        {formatShareExpiryChipLabel(s.expiryDatetime)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex w-full shrink-0 flex-col gap-1.5 border-t border-border/40 pt-2 sm:w-auto sm:border-t-0 sm:pt-0">
                                <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-1.5">
                                  <label className="sr-only" htmlFor={`share-exp-${s.id}`}>
                                    Access expires
                                  </label>
                                  <Input
                                    id={`share-exp-${s.id}`}
                                    type="datetime-local"
                                    value={rowExpiryDraft[s.id] ?? isoToDatetimeLocal(s.expiryDatetime)}
                                    onChange={(e) =>
                                      setRowExpiryDraft((prev) => ({ ...prev, [s.id]: e.target.value }))
                                    }
                                    disabled={revoking}
                                    className="h-8 w-full max-w-[18rem] rounded-md border-border/70 bg-muted/30 py-1 text-xs leading-tight"
                                  />
                                  <div className="flex shrink-0 items-center gap-0.5">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      disabled={savingExp || revoking}
                                      title="Save expiry"
                                      aria-label="Save expiry"
                                      onClick={() => void saveShareRowExpiry(s)}
                                    >
                                      {savingExp ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      disabled={revoking || savingExp}
                                      title="Remove access"
                                      aria-label="Remove access"
                                      onClick={() => void revokeShare(s.id)}
                                    >
                                      {revoking ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                                {s.expiryDatetime && !s.shareNeverExpires ? (
                                  <div className="flex w-full shrink-0 justify-end">
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-8 shrink-0 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                      disabled={savingExp || revoking}
                                      title="Remove expiry — access does not end"
                                      onClick={() => void makeShareForever(s)}
                                    >
                                      {savingExp ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <>
                                          <Infinity className="h-3.5 w-3.5" aria-hidden />
                                          Forever
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
            </div>
          </div>

          <DialogFooter className="shrink-0 flex flex-col gap-3 border-t border-border/60 bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:bg-muted/10">
            <p className="order-2 text-center text-xs text-muted-foreground sm:order-1 sm:text-left">
              {shareSelectedUserIds.length === 0
                ? "Select users under Share with users, then Share."
                : `${shareSelectedUserIds.length} user${shareSelectedUserIds.length === 1 ? "" : "s"} will receive access.`}
            </p>
            <div className="order-1 flex w-full flex-wrap justify-end gap-2 sm:order-2 sm:w-auto">
              <Button variant="outline" className="rounded-xl" onClick={() => setShareOpen(false)}>
                Close
              </Button>
              <Button
                className="rounded-xl gap-2 bg-indigo-600 font-semibold text-white hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                disabled={
                  shareBulkAdding ||
                  shareSelectedUserIds.length === 0 ||
                  shareListLoading ||
                  (shareDefaultExpiryMode === "custom" && !shareExpiry.trim())
                }
                onClick={() => void addSelectedUsersToShare()}
              >
                {shareBulkAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                Share
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className={cn(modalShell, "sm:max-w-md")}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground">
              Are you sure you want to delete?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[15px] text-muted-foreground">
              This credential will be removed from your vault. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-red-600 font-semibold text-white hover:bg-red-500" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
