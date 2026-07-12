import { useCallback, useMemo, useRef, useState } from "react";
import { AtSign, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import { formatMentionToken, type MentionMember } from "@/components/pms/pmsCommentMentions";
import { useNonPassiveWheel } from "@/hooks/useNonPassiveWheel";

type Props = {
  members: MentionMember[];
  onInsert: (mention: string) => void;
  disabled?: boolean;
  className?: string;
};

export function PmsCommentMentionPicker({ members, onInsert, disabled = false, className }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listScrollRef = useRef<HTMLDivElement>(null);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query),
    );
  }, [members, search]);

  const handleListWheel = useCallback((event: WheelEvent) => {
    const container = listScrollRef.current;
    if (!container) return;

    const canScrollVertically = container.scrollHeight > container.clientHeight;
    if (!canScrollVertically) return;

    event.preventDefault();
    event.stopPropagation();
    container.scrollTop += event.deltaY;
  }, []);

  useNonPassiveWheel(listScrollRef, handleListWheel, open);

  const handleSelect = (member: MentionMember) => {
    onInsert(`${formatMentionToken(member.name, member.userId)} `);
    setOpen(false);
    setSearch("");
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50",
            open && "bg-slate-100 text-slate-700",
            className,
          )}
          aria-label="Mention someone"
        >
          <AtSign className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-[min(280px,calc(100vw-2rem))] overflow-hidden rounded-xl border-slate-200 p-0 shadow-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b border-slate-100 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members…"
              className="h-8 border-slate-200 pl-8 text-sm shadow-none"
            />
          </div>
        </div>
        <div
          ref={listScrollRef}
          className="max-h-[220px] overflow-y-auto overscroll-y-contain p-1 scrollbar-thin"
        >
          {filteredMembers.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              {members.length === 0 ? "No project members" : "No members match your search"}
            </p>
          ) : (
            filteredMembers.map((member) => (
              <button
                key={member.userId}
                type="button"
                onClick={() => handleSelect(member)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
              >
                <PmsMemberAvatar name={member.name} userId={member.userId} size="sm" hideTitle />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{member.name}</span>
                  {member.email ? (
                    <span className="block truncate text-xs text-slate-500">{member.email}</span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
