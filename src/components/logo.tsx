import Image from "next/image";
import { cn } from "@/lib/utils";

/** ONYX faceted polyhedron gemstone logo */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center select-none overflow-hidden",
        className
      )}
      aria-hidden
      role="presentation"
    >
      <Image
        src="/onyx-gem.png"
        alt="ONYX logo"
        width={80}
        height={80}
        className="h-full w-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
        priority
      />
    </span>
  );
}