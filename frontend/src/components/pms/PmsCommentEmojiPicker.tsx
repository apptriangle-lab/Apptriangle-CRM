import { useCallback, useMemo, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PMS_COMMENT_EMOJI_CATEGORIES } from "@/components/pms/pmsCommentEmojis";
import { useNonPassiveWheel } from "@/hooks/useNonPassiveWheel";

type Props = {
  onInsert: (emoji: string) => void;
  disabled?: boolean;
  className?: string;
};

export function PmsCommentEmojiPicker({ onInsert, disabled = false, className }: Props) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(PMS_COMMENT_EMOJI_CATEGORIES[0]?.id ?? "smileys");
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const emojiScrollRef = useRef<HTMLDivElement>(null);

  const activeEmojis = useMemo(
    () => PMS_COMMENT_EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.emojis ?? [],
    [activeCategory],
  );

  const handleCategoryWheel = useCallback((event: WheelEvent) => {
    const container = categoryScrollRef.current;
    if (!container) return;

    const canScrollHorizontally = container.scrollWidth > container.clientWidth;
    if (!canScrollHorizontally) return;

    event.preventDefault();
    event.stopPropagation();
    container.scrollLeft += event.deltaY || event.deltaX;
  }, []);

  const handleEmojiWheel = useCallback((event: WheelEvent) => {
    const container = emojiScrollRef.current;
    if (!container) return;

    const canScrollVertically = container.scrollHeight > container.clientHeight;
    if (!canScrollVertically) return;

    event.preventDefault();
    event.stopPropagation();
    container.scrollTop += event.deltaY;
  }, []);

  useNonPassiveWheel(categoryScrollRef, handleCategoryWheel, open);
  useNonPassiveWheel(emojiScrollRef, handleEmojiWheel, open);

  const handleSelect = (emoji: string) => {
    onInsert(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50",
            open && "bg-slate-100 text-slate-700",
            className,
          )}
          aria-label="Insert emoji"
        >
          <Smile className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-xl border-slate-200 p-0 shadow-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b border-slate-100 px-2 pt-2">
          <div
            ref={categoryScrollRef}
            className="flex flex-nowrap gap-0.5 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2 scrollbar-thin"
          >
            {PMS_COMMENT_EMOJI_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                  activeCategory === category.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
        <div
          ref={emojiScrollRef}
          className="h-[220px] overflow-y-auto overscroll-y-contain p-2 scrollbar-thin"
        >
          <div className="grid grid-cols-8 gap-0.5">
            {activeEmojis.map((emoji, index) => (
              <Button
                key={`${activeCategory}-${emoji}-${index}`}
                type="button"
                variant="ghost"
                className="h-8 w-8 rounded-md p-0 text-lg hover:bg-slate-100"
                onClick={() => handleSelect(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
