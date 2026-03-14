import { cn } from "@/lib/cn";

type Variant = "default" | "success" | "warning" | "danger" | "info";
type Size = "sm" | "md";

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
};

const variantStyles: Record<Variant, string> = {
  default: "bg-white/10 text-white/70 border-white/10",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  danger: "bg-red-500/15 text-red-400 border-red-500/20",
  info: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
};

/**
 * A small pill badge for status indicators and labels.
 */
export function Badge({
  children,
  variant = "default",
  size = "md",
  className,
}: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium border",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
