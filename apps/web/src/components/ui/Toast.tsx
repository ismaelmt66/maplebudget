"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ToastType = "success" | "error" | "info";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: ToastType = "info", duration: number = 4000) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        if (duration > 0) {
            setTimeout(() => removeToast(id), duration);
        }
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
    // Unmount animation state could be added here for more complexity, 
    // but a simple entry animation via CSS is often enough.
    return (
        <div
            className={cn(
                "mb-toast pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md text-sm font-medium",
                toast.type === "success" && "border-green-500/30 bg-green-500/10 text-green-50",
                toast.type === "error" && "border-red-500/30 bg-red-500/10 text-red-50",
                toast.type === "info" && "border-blue-500/30 bg-blue-500/10 text-blue-50"
            )}
            role="alert"
        >
            <span>{toast.message}</span>
            <button
                onClick={onRemove}
                className="opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Close"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
