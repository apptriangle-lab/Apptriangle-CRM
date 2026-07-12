import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import {
  Plus,
  X,
  ListChecks,
  Flame,
  TrendingUp,
  Pencil,
  Check,
  Settings2,
  ArrowRight,
  Package,
  ClipboardList,
  FolderKanban,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { OrderConfigPatchGroup, OrderStatusConfigItem } from "@/lib/api";

type GroupKey =
  | "taskStatuses"
  | "pmsTaskStatuses"
  | "salesCategories"
  | "salesStatuses"
  | "orderStatuses"
  | "orderNextTodos";

interface GroupConfig {
  key: GroupKey;
  label: string;
  icon: React.ReactNode;
  description: string;
  accentColor: string;
  dotColor: string;
  pillBg: string;
  pillText: string;
}

const groupConfigs: GroupConfig[] = [
  {
    key: "taskStatuses",
    label: "Task Statuses",
    icon: <ListChecks className="h-5 w-5" />,
    description: "Define the lifecycle stages for CRM tasks",
    accentColor: "from-primary/20 to-primary/5",
    dotColor: "bg-primary",
    pillBg: "bg-primary/8 hover:bg-primary/12 border-primary/15",
    pillText: "text-primary",
  },
  {
    key: "pmsTaskStatuses",
    label: "PMS Task Statuses",
    icon: <FolderKanban className="h-5 w-5" />,
    description: "Kanban columns and status options for PMS project tasks",
    accentColor: "from-violet-500/20 to-violet-500/5",
    dotColor: "bg-violet-500",
    pillBg: "bg-violet-500/8 hover:bg-violet-500/12 border-violet-500/15",
    pillText: "text-violet-700 dark:text-violet-300",
  },
  {
    key: "salesCategories",
    label: "Sales Categories",
    icon: <Flame className="h-5 w-5" />,
    description: "Classify deals by temperature",
    accentColor: "from-warning/20 to-warning/5",
    dotColor: "bg-warning",
    pillBg: "bg-warning/8 hover:bg-warning/12 border-warning/15",
    pillText: "text-warning",
  },
  {
    key: "salesStatuses",
    label: "Sales Statuses",
    icon: <TrendingUp className="h-5 w-5" />,
    description: "Track deal progression stages",
    accentColor: "from-accent/20 to-accent/5",
    dotColor: "bg-accent",
    pillBg: "bg-accent/8 hover:bg-accent/12 border-accent/15",
    pillText: "text-accent",
  },
  {
    key: "orderStatuses",
    label: "Order Statuses",
    icon: <Package className="h-5 w-5" />,
    description: "Workflow statuses for orders; inactive items are hidden from the order status dropdown",
    accentColor: "from-info/20 to-info/5",
    dotColor: "bg-info",
    pillBg: "bg-info/8 hover:bg-info/12 border-info/15",
    pillText: "text-info",
  },
  {
    key: "orderNextTodos",
    label: "Order Next To Do",
    icon: <ClipboardList className="h-5 w-5" />,
    description: "Preset next steps for orders; inactive items are hidden from the Next to do dropdown",
    accentColor: "from-success/20 to-success/5",
    dotColor: "bg-success",
    pillBg: "bg-success/8 hover:bg-success/12 border-success/15",
    pillText: "text-success",
  },
];

export function StatusSettings({ hideHeader = false }: { hideHeader?: boolean }) {
  const {
    taskStatuses,
    pmsTaskStatuses,
    salesCategories,
    salesStatuses,
    orderStatuses,
    orderNextTodos,
    addStatus,
    removeStatus,
    patchOrderOptionActive,
    loading,
  } = useStatusConfig();
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  const getItems = (key: GroupKey): string[] => {
    if (key === "taskStatuses") return taskStatuses;
    if (key === "pmsTaskStatuses") return pmsTaskStatuses;
    if (key === "salesCategories") return salesCategories;
    if (key === "salesStatuses") return salesStatuses;
    return [];
  };

  const handleAdd = async (groupKey: GroupKey) => {
    const value = newValues[groupKey]?.trim().toLowerCase().replace(/\s+/g, "_");
    if (!value) return;
    const success = await addStatus(groupKey, value);
    if (!success) {
      toast.error("This status already exists or you need admin access");
      return;
    }
    setNewValues((prev) => ({ ...prev, [groupKey]: "" }));
    toast.success("Status added successfully");
  };

  const handleRemove = async (groupKey: GroupKey, item: string) => {
    const success = await removeStatus(groupKey, item);
    if (!success) {
      const orderGroups = groupKey === "orderStatuses" || groupKey === "orderNextTodos";
      toast.error(orderGroups ? "You need admin access" : "Must have at least one status or you need admin access");
      return;
    }
    toast.success("Removed");
  };

  const handleOrderOptionToggle = async (patchGroup: OrderConfigPatchGroup, value: string, isActive: boolean) => {
    const success = await patchOrderOptionActive(patchGroup, value, isActive);
    if (!success) {
      toast.error("Could not update or you need admin access");
      return;
    }
    toast.success(isActive ? "Shown in order dropdown" : "Hidden from order dropdown");
  };

  const formatLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return (
      <Loader message="Loading statuses…" size="lg" className="py-16" />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">Status Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure statuses and categories used across your CRM pipeline
            </p>
          </div>
        </div>
      )}

      {/* Status Groups */}
      <div className="space-y-5">
        {groupConfigs.map((group) => {
          const isEditing = editingGroup === group.key;
          const items =
            group.key === "orderStatuses"
              ? orderStatuses
              : group.key === "orderNextTodos"
                ? orderNextTodos
                : getItems(group.key);

          return (
            <div
              key={group.key}
              className={`rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300 ${
                isEditing ? "ring-2 ring-primary/20 shadow-lg" : "hover:shadow-md"
              }`}
            >
              {/* Gradient accent bar */}
              <div className={`h-1 bg-gradient-to-r ${group.accentColor}`} />

              {/* Group Header */}
              <div className="flex items-center justify-between px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${group.accentColor} flex items-center justify-center ${group.pillText}`}>
                    {group.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-semibold text-foreground">{group.label}</h3>
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                        {items.length}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
                  </div>
                </div>
                <Button
                  variant={isEditing ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditingGroup(isEditing ? null : group.key)}
                  className={`gap-1.5 transition-all ${isEditing ? "" : "hover:border-primary/30 hover:text-primary"}`}
                >
                  {isEditing ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Done
                    </>
                  ) : (
                    <>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </>
                  )}
                </Button>
              </div>

              {/* Status Flow */}
              <div className="px-6 pb-6">
                <div className="rounded-xl bg-muted/30 border border-border/50 p-4">
                  {/* Flow visualization */}
                  <div className="flex flex-wrap items-center gap-2">
                    {group.key === "orderStatuses" || group.key === "orderNextTodos"
                      ? (items as OrderStatusConfigItem[]).map((row, index, arr) => (
                          <div key={row.value} className="flex items-center gap-2">
                            <div
                              className={`relative inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all duration-200 ${group.pillBg} ${group.pillText} ${
                                isEditing ? "pr-2" : ""
                              } ${!row.isActive ? "opacity-55" : ""}`}
                            >
                              <div className={`h-2 w-2 rounded-full ${group.dotColor} shrink-0`} />
                              <span className="whitespace-nowrap">{formatLabel(row.value)}</span>
                              {!row.isActive && (
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Inactive</span>
                              )}
                              {isEditing && (
                                <>
                                  <Switch
                                    className="scale-90"
                                    checked={row.isActive}
                                    onCheckedChange={(v) =>
                                      handleOrderOptionToggle(group.key as OrderConfigPatchGroup, row.value, v)
                                    }
                                    title={row.isActive ? "Active (shown in dropdown)" : "Inactive (hidden from dropdown)"}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemove(group.key, row.value)}
                                    className="ml-0.5 rounded-full p-1 hover:bg-destructive/15 hover:text-destructive transition-colors"
                                    title={`Remove ${formatLabel(row.value)}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                            {index < arr.length - 1 && (
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            )}
                          </div>
                        ))
                      : (items as string[]).map((item, index) => (
                          <div key={item} className="flex items-center gap-2">
                            <div
                              className={`relative inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all duration-200 ${group.pillBg} ${group.pillText} ${
                                isEditing ? "pr-2" : ""
                              }`}
                            >
                              <div className={`h-2 w-2 rounded-full ${group.dotColor} shrink-0`} />
                              <span className="whitespace-nowrap">{formatLabel(item)}</span>
                              {isEditing && (
                                <button
                                  onClick={() => handleRemove(group.key, item)}
                                  className="ml-0.5 rounded-full p-1 hover:bg-destructive/15 hover:text-destructive transition-colors"
                                  title={`Remove ${formatLabel(item)}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {index < (items as string[]).length - 1 && (
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            )}
                          </div>
                        ))}
                  </div>

                  {/* Add New Status */}
                  {isEditing && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2 max-w-md">
                        <div className="relative flex-1">
                          <Input
                            placeholder="Type a new status name…"
                            value={newValues[group.key] || ""}
                            onChange={(e) =>
                              setNewValues((prev) => ({ ...prev, [group.key]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAdd(group.key);
                            }}
                            className="h-10 text-sm pl-3 pr-3 rounded-xl bg-background"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAdd(group.key)}
                          disabled={!newValues[group.key]?.trim()}
                          className="h-10 rounded-xl px-4 gap-1.5 shrink-0"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Press Enter or click Add. Spaces will be converted to underscores.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
