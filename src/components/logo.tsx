/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/**
 * Brand mark — frameless. Renders the studio logo from /public/wesualise-logo.png
 * at the given size, aligned inline with the wordmark. No background chip.
 */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/wesualise-logo.png"
      alt="Wesualize Studios"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
