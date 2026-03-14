import { cn } from "@/lib/cn";

type Props = {
  title: string;
  gradient?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
};

/**
 * Page header with an optional gradient-colored portion of the title,
 * a subtitle, and a right-aligned slot for action buttons.
 */
export function PageHeader({
  title,
  gradient,
  subtitle,
  children,
  className,
}: Props) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <h1 className="text-3xl font-bold text-white">
          {title}
          {gradient && (
            <>
              {" "}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                {gradient}
              </span>
            </>
          )}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
