import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { mockCompanies, mockContacts, getCompanyName, getUserName } from "@/data/mockData";
import { useTaskStore } from "@/contexts/TaskStoreContext";
import { useSalesStore } from "@/contexts/SalesStoreContext";
import { Building2, Users, CheckSquare, DollarSign, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: "company" | "contact" | "task" | "sale";
  id: string;
  title: string;
  subtitle: string;
  path: string;
}

const icons = {
  company: Building2,
  contact: Users,
  task: CheckSquare,
  sale: DollarSign,
};

const typeLabels = {
  company: "Company",
  contact: "Contact",
  task: "Task",
  sale: "Sale",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { tasks } = useTaskStore();
  const { sales } = useSalesStore();

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const out: SearchResult[] = [];

    mockCompanies.forEach(c => {
      if (c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q))
        out.push({ type: "company", id: c.id, title: c.name, subtitle: `${c.location} · ${c.country}`, path: `/companies/${c.id}` });
    });

    mockContacts.forEach(c => {
      if (c.name.toLowerCase().includes(q) || c.mobile.includes(q) || (c.email?.toLowerCase().includes(q)))
        out.push({ type: "contact", id: c.id, title: c.name, subtitle: `${getCompanyName(c.companyId)} · ${c.designation ?? ""}`, path: `/contacts` });
    });

    tasks.forEach(t => {
      if (t.title.toLowerCase().includes(q))
        out.push({ type: "task", id: t.id, title: t.title, subtitle: `${getCompanyName(t.companyId)} · ${getUserName(t.assignToUserId)}`, path: `/tasks/${t.id}` });
    });

    sales.forEach(s => {
      if (s.prospect.toLowerCase().includes(q))
        out.push({ type: "sale", id: s.id, title: s.prospect, subtitle: `${getCompanyName(s.companyId)} · $${s.expectedRevenue.toLocaleString()}`, path: `/sales/${s.id}` });
    });

    return out.slice(0, 15);
  }, [query, tasks, sales]);

  const select = useCallback((r: SearchResult) => {
    navigate(r.path);
    setOpen(false);
    setQuery("");
  }, [navigate]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate">Search...</span>
        <kbd className="hidden sm:inline-flex text-[10px] bg-sidebar-accent text-sidebar-foreground px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setQuery(""); }}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search companies, contacts, tasks, deals..."
              className="border-0 focus-visible:ring-0 shadow-none text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {query.trim() && results.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">No results found</div>
            )}
            {results.map(r => {
              const Icon = icons[r.type];
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => select(r)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{typeLabels[r.type]}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
