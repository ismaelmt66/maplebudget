"use client";

import React, { useEffect, useRef, useState } from "react";
import { getHealthScore, HealthScoreResponse } from "@/lib/api";

type ColorInfo = { text: string; stroke: string; bgFaint: string; bgStrong: string; glow: string };

/** Map API color string to design tokens */
function colorClasses(color: string): ColorInfo {
  switch (color) {
    case "red":
      return {
        text: "text-red-500",
        stroke: "stroke-red-500",
        bgFaint: "rgba(239,68,68,0.15)",
        bgStrong: "rgba(239,68,68,0.8)",
        glow: "rgba(239,68,68,0.6)",
      };
    case "orange":
      return {
        text: "text-orange-500",
        stroke: "stroke-orange-500",
        bgFaint: "rgba(249,115,22,0.15)",
        bgStrong: "rgba(249,115,22,0.8)",
        glow: "rgba(249,115,22,0.6)",
      };
    case "yellow":
      return {
        text: "text-yellow-500",
        stroke: "stroke-yellow-500",
        bgFaint: "rgba(234,179,8,0.15)",
        bgStrong: "rgba(234,179,8,0.8)",
        glow: "rgba(234,179,8,0.6)",
      };
    default: // green
      return {
        text: "text-emerald-500",
        stroke: "stroke-emerald-500",
        bgFaint: "rgba(16,185,129,0.15)",
        bgStrong: "rgba(16,185,129,0.8)",
        glow: "rgba(16,185,129,0.6)",
      };
  }
}

/** Thin progress bar for each breakdown dimension */
function BreakdownBar({ label, value, color }: { label: string; value: number; color: string }) {
  const [displayed, setDisplayed] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const duration = 900;
    function step(ts: number) {
      if (!start.current) start.current = ts;
      const elapsed = ts - start.current;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayed(Math.round(progress * value));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, [value]);

  const clss = colorClasses(color);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm opacity-80">
        <span>{label}</span>
        <span className={clss.text + " font-semibold"}>{displayed}/100</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${displayed}%`,
            background: clss.bgStrong,
            boxShadow: `0 0 8px ${clss.bgFaint}`,
          }}
        />
      </div>
    </div>
  );
}

/** Circular SVG gauge that animates from 0 to the given score */
function CircularGauge({ score, color }: { score: number; color: string }) {
  const [displayed, setDisplayed] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    start.current = null;
    setDisplayed(0);
    const duration = 1200;
    function step(ts: number) {
      if (!start.current) start.current = ts;
      const elapsed = ts - start.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * score));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, [score]);

  const clss = colorClasses(color);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - displayed / 100);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={180} height={180} className="-rotate-90">
        <circle
          cx={90}
          cy={90}
          r={radius}
          fill="none"
          className="stroke-white/5"
          strokeWidth={10}
        />
        <circle
          cx={90}
          cy={90}
          r={radius}
          fill="none"
          className={clss.stroke}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.05s linear", filter: `drop-shadow(0 0 8px ${clss.glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${clss.text}`}>{displayed}</span>
      </div>
    </div>
  );
}

/** Loading skeleton */
function Skeleton() {
  return (
    <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-white/5 p-6 animate-pulse space-y-4">
      <div className="h-5 w-40 rounded bg-white/10" />
      <div className="flex justify-center">
        <div className="w-44 h-44 rounded-full bg-white/10" />
      </div>
      <div className="space-y-3">
        <div className="h-4 rounded bg-white/10" />
        <div className="h-4 rounded bg-white/10" />
        <div className="h-4 rounded bg-white/10" />
      </div>
    </div>
  );
}

/** Main exported component */
export default function HealthScoreGauge() {
  const [data, setData] = useState<HealthScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHealthScore()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  if (!data) return null;

  const clss = colorClasses(data.color);

  return (
    <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-white/5 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold">Score de Santé Financière</div>
          <div className="text-xs opacity-60 mt-0.5">Basé sur vos habitudes financières</div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${clss.text}`}
          style={{ background: clss.bgFaint, borderColor: clss.bgStrong }}
        >
          {data.label}
        </span>
      </div>

      <div className="flex justify-center">
        <CircularGauge score={data.score} color={data.color} />
      </div>

      <div className="space-y-3">
        <BreakdownBar label="Épargne" value={data.breakdown.savings_rate} color={data.color} />
        <BreakdownBar label="Budgets" value={data.breakdown.budget_adherence} color={data.color} />
        <BreakdownBar label="Objectifs" value={data.breakdown.goals_progress} color={data.color} />
      </div>

      {data.recommendations.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-white/5">
          <div className="text-xs opacity-60 uppercase tracking-wider font-medium">Recommandations</div>
          <ul className="space-y-1.5">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm opacity-80">
                <span className={`mt-0.5 shrink-0 ${clss.text}`}>→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
