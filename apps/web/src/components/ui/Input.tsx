"use client";

import { cn } from "@/lib/cn";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border bg-[rgb(var(--surface))] px-3 py-2.5 text-sm " +
          "placeholder:text-black/40 " +
          "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ring))] focus:ring-offset-2 focus:ring-offset-[rgb(var(--bg))]",
        className
      )}
      {...props}
    />
  );
}