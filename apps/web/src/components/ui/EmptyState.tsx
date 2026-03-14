"use client";

import { cn } from "@/lib/cn";

type Props = {
  icon: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
};

/**
 * A placeholder component shown when a section has no data.
 * Displays a large emoji icon, title, optional description, and an optional CTA.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: Props) {
  const actionEl = action ? (
    action.href ? (
      <a
        href={action.href}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
      >
        {action.label}
      </a>
    ) : (
      <button
        onClick={action.onClick}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
      >
        {action.label}
      </button>
    )
  ) : null;

  return (
    <div
      className={cn(
        "text-center py-16 rounded-2xl bg-white/5 border border-dashed border-white/20",
        className
      )}
    >
      <span className="text-5xl" role="img" aria-label={title}>
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-semibold text-white/70">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-white/40">{description}</p>
      )}
      {actionEl}
    </div>
  );
}
