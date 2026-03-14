import { cn } from "@/lib/cn";

type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
} as const;

/**
 * A lightweight animated spinner for loading states.
 */
export function Spinner({ size = "md", className }: Props) {
  return (
    <div
      className={cn(
        "rounded-full border-2 border-white/20 border-t-white/80 animate-spin",
        sizes[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
