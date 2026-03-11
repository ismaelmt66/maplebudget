"use client";

import React from "react";
import Image from "next/image";

interface LogoProps {
  className?: string;
}

export const Logo = ({ className = "" }: LogoProps) => {
  return (
    <div className={`flex items-center gap-1 font-bold text-xl tracking-tight ${className}`}>
      <Image
        src="/logo.png"
        alt="NexLedger logo"
        width={112}
        height={112}
        className="rounded-xl object-contain [mix-blend-mode:screen] drop-shadow-[0_0_12px_rgba(139,92,246,0.8)]"
      />
      <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
        NexLedger
      </span>
    </div>
  );
};
