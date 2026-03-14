"use client";

import { cn } from "@/lib/cn";

type Tab = {
  id: string;
  label: string;
  icon?: string;
};

type Props = {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
};

/**
 * A horizontal tab bar with glassmorphism styling.
 */
export function Tabs({ tabs, activeTab, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "flex gap-1 p-1 bg-white/5 border border-white/[0.08] rounded-2xl w-fit",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition",
              isActive
                ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                : "text-white/40 hover:text-white/70"
            )}
          >
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
