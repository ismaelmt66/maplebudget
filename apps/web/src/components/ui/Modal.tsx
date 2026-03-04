"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-md" }: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Prevent background scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                ref={overlayRef}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={(e) => {
                    if (e.target === overlayRef.current) onClose();
                }}
                aria-hidden="true"
            />

            {/* Modal Content */}
            <div
                className={cn(
                    "relative w-full bg-[#1C1F26] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 text-left transform transition-all",
                    maxWidth,
                    "animate-in fade-in zoom-in-95 duration-200"
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className="flex items-center justify-between mb-5">
                    <h3 id="modal-title" className="text-xl font-semibold tracking-tight text-white">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Fermer"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div>{children}</div>
            </div>
        </div>
    );
}
