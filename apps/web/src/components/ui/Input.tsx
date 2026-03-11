"use client";

import { cn } from "@/lib/cn";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Standardized input component for forms throughout the application.
 * Manages its own focus states and tailwind classes internally.
 */
export function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn("mb-input", className)}
      {...props}
    />
  );
}