import { Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

// Reverie wordmark with a crimson film-strip mark, matching the deck's title slide.
export function BrandLogo({ className }: Props) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Film className="h-4 w-4" />
      </span>
      <span
        className="text-2xl font-extrabold tracking-tight text-white"
        style={{
          textShadow:
            "2px 2px 0 hsl(var(--primary)), 4px 4px 0 hsl(var(--primary) / 0.45)",
        }}
      >
        Reverie
      </span>
    </div>
  );
}
