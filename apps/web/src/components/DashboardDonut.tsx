"use client";

import React, { useMemo, useState } from "react";
import { money } from "@/lib/format";

interface DonutData {
    id: number;
    label: string;
    value: number;
    color: string;
}

interface DonutProps {
    data: DonutData[];
    size?: number;
    strokeWidth?: number;
    centerTextTop?: string;
    centerTextBottom?: string;
}

export function DonutChart({
    data,
    size = 240,
    strokeWidth = 24,
    centerTextTop = "",
    centerTextBottom = ""
}: DonutProps) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    const radius = (size - strokeWidth) / 2 - 10; // Extra padding for glow
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    const total = useMemo(() => data.reduce((acc, item) => acc + item.value, 0), [data]);

    // Calculate SVG stroke-dasharray and stroke-dashoffset for each segment
    const segments = useMemo(() => {
        return data.reduce((acc, item) => {
            const percentage = total > 0 ? item.value / total : 0;
            const strokeLength = percentage * circumference;

            const segment = {
                ...item,
                percentage,
                strokeDasharray: `${Math.max(0, strokeLength - 4)} ${circumference}`, // -4 creates a nice gap between slices
                strokeDashoffset: -acc.currentOffset,
            };

            acc.list.push(segment);
            acc.currentOffset += strokeLength;
            return acc;
        }, { list: [] as (DonutData & { percentage: number; strokeDasharray: string; strokeDashoffset: number })[], currentOffset: 0 }).list;
    }, [data, total, circumference]);

    if (total === 0) {
        return (
            <div
                className="flex items-center justify-center rounded-full border border-white/5 bg-white/[0.02] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"
                style={{ width: size, height: size }}
            >
                <span className="text-sm font-medium opacity-40 uppercase tracking-widest">Aucune donnée</span>
            </div>
        );
    }

    const activeItem = hoveredIdx !== null ? segments[hoveredIdx] : null;

    return (
        <div className="relative group flex items-center justify-center transition-transform duration-500 hover:scale-105" style={{ width: size, height: size }}>
            {/* Tooltip on hover */}
            {activeItem && (
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 mb-tooltip whitespace-nowrap z-20 pointer-events-none animate-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: activeItem.color, color: activeItem.color }} />
                        <span className="font-semibold text-sm text-white">{activeItem.label}</span>
                        <span className="text-sm font-bold opacity-90 pl-3 border-l border-white/20">{money(activeItem.value)}</span>
                    </div>
                </div>
            )}

            {/* SVG Donut */}
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 drop-shadow-2xl overflow-visible">
                <defs>
                    <filter id="donutGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="centerGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="20" result="blur" />
                    </filter>
                </defs>

                {/* Soft glow in the center depending on active item */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius - strokeWidth}
                    fill={activeItem ? activeItem.color : "rgba(255,255,255,0.05)"}
                    opacity="0.15"
                    filter="url(#centerGlow)"
                    className="transition-colors duration-500"
                />

                {/* Background ring */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth={strokeWidth}
                />

                {/* Fill rings */}
                {segments.map((seg, i) => (
                    seg.percentage > 0 && (
                        <circle
                            key={seg.id}
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={hoveredIdx === i ? strokeWidth + 4 : strokeWidth}
                            strokeDasharray={seg.strokeDasharray}
                            strokeDashoffset={seg.strokeDashoffset}
                            strokeLinecap="round"
                            filter={hoveredIdx === i ? "url(#donutGlow)" : "none"}
                            className="transition-all duration-300 ease-out cursor-pointer origin-center animate-in fade-in"
                            style={{
                                filter: hoveredIdx === i ? 'brightness(1.2)' : hoveredIdx !== null ? 'brightness(0.4) grayscale(50%)' : 'none',
                                animation: 'drawPath 1.5s ease-out forwards',
                            }}
                            onMouseEnter={() => setHoveredIdx(i)}
                            onMouseLeave={() => setHoveredIdx(null)}
                        />
                    )
                ))}
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300">
                {activeItem ? (
                    <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
                        <span className="text-xs font-semibold text-white/50 tracking-widest uppercase mb-1">{activeItem.label}</span>
                        <span className="text-3xl font-extrabold tracking-tighter drop-shadow-lg" style={{ color: activeItem.color }}>
                            {Math.round(activeItem.percentage * 100)}%
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        {centerTextTop && <span className="text-xs font-bold text-white/40 tracking-widest uppercase mb-1">{centerTextTop}</span>}
                        {centerTextBottom && (
                            <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 tracking-tight">
                                {centerTextBottom}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
