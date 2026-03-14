import { cn } from "@/lib/cn";

type Props = {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  color?: string;
  className?: string;
};

/**
 * A compact stat card displaying a label, prominent value,
 * optional icon, and an optional trend badge.
 */
export function StatCard({
  label,
  value,
  icon,
  trend,
  color,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "relative bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-5",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "absolute top-4 right-4 text-lg",
            color ?? "text-white/30"
          )}
        >
          {icon}
        </div>
      )}

      <p className="text-xs font-medium uppercase tracking-wider text-white/50">
        {label}
      </p>

      <p className={cn("mt-2 text-2xl font-bold text-white", color)}>
        {value}
      </p>

      {trend && (
        <span
          className={cn(
            "mt-2 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
            trend.positive
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-red-500/15 text-red-400"
          )}
        >
          {trend.positive ? "+" : ""}
          {trend.value}%
        </span>
      )}
    </div>
  );
}
