/**
 * Utility to merge tailwind class names securely, ignoring falsy values.
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}