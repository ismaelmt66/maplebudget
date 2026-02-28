"use client";

import { cn } from "@/lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-xl font-medium transition " +
    "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ring))] focus:ring-offset-2 focus:ring-offset-[rgb(var(--bg))] " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-base",
  }[size];

  const styles = {
    primary:
      "text-white shadow-[0_12px_35px_rgba(2,6,23,0.20)] " +
      "bg-[linear-gradient(135deg,rgb(var(--navy)),rgb(var(--navy-2)))] hover:brightness-[1.03] " +
      "border border-white/10",
    secondary:
      "bg-[rgb(var(--surface))] hover:bg-black/[0.03] border shadow-sm",
    ghost:
      "bg-transparent hover:bg-black/[0.04] border border-transparent hover:border-black/10",
    danger:
      "text-white bg-[rgb(var(--danger))] hover:brightness-[1.03] border border-white/10",
  }[variant];

  return <button className={cn(base, sizes, styles, className)} {...props} />;
}