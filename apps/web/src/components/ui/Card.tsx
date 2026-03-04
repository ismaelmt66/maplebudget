import { cn } from "@/lib/cn";

/**
 * A container component providing the signature rounded, elevated UI
 * aesthetic representing a physical context (like a bank card or dashboard widget).
 */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border bg-[rgb(var(--surface))] " +
        "shadow-[0_18px_60px_rgba(2,6,23,0.08)]",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Inner padding wrapper for a Card component.
 */
export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-7", className)}>{children}</div>;
}