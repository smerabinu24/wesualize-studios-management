import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto scrollbar-thin rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}
export function Thead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground" {...props} />;
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("px-4 py-3 font-medium", className)} {...props} />;
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}
export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-t border-border transition-colors hover:bg-muted/40", className)} {...props} />;
}
