import { Flag } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { usePmsSprints } from "@/contexts/PmsSprintContext";

type Props = {
  value: string | null;
  onChange: (sprintId: string | null) => void;
  allowNone?: boolean;
};

export function PmsSprintField({ value, onChange, allowNone = true }: Props) {
  const { sprints, loading } = usePmsSprints();

  return (
    <div className="grid gap-2">
      <Label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
        <Flag className="h-3.5 w-3.5 text-indigo-500" />
        Sprint
      </Label>
      <Select
        value={value ?? "__none__"}
        onValueChange={(v) => onChange(v === "__none__" ? null : v)}
        disabled={loading}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select sprint" />
        </SelectTrigger>
        <SelectContent>
          {allowNone ? <SelectItem value="__none__">Backlog (no sprint)</SelectItem> : null}
          {sprints.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
