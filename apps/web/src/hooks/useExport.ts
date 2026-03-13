"use client";

import { useState, useCallback } from "react";
import { ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

/** Filter parameters supported by both CSV and PDF export endpoints. */
export interface ExportFilters {
  date_from?: string;
  date_to?: string;
  category_id?: number;
  amount_min?: number;
  amount_max?: number;
}

export type ExportFormat = "csv" | "pdf";

export interface UseExportReturn {
  /** Whether an export request is currently in flight. */
  loading: boolean;
  /** Last error message, or null if the last export succeeded. */
  error: string | null;
  /**
   * Trigger a file export. The browser will start a download when the
   * response arrives.
   *
   * @param format  "csv" or "pdf"
   * @param filters Optional date / category / amount filters
   */
  exportTransactions: (format: ExportFormat, filters?: ExportFilters) => Promise<void>;
}

/**
 * Hook that calls the backend export endpoints and triggers a browser
 * file download when the response arrives.
 *
 * @example
 * ```tsx
 * const { loading, error, exportTransactions } = useExport();
 * await exportTransactions("csv", { date_from: "2024-01-01" });
 * ```
 */
export function useExport(): UseExportReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportTransactions = useCallback(
    async (format: ExportFormat, filters: ExportFilters = {}) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (filters.date_from) params.set("date_from", filters.date_from);
        if (filters.date_to) params.set("date_to", filters.date_to);
        if (filters.category_id != null)
          params.set("category_id", String(filters.category_id));
        if (filters.amount_min != null)
          params.set("amount_min", String(filters.amount_min));
        if (filters.amount_max != null)
          params.set("amount_max", String(filters.amount_max));

        const qs = params.toString();
        const url = `${API_BASE}/transactions/export/${format}${qs ? `?${qs}` : ""}`;

        const token = getToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(url, {
          method: "GET",
          headers,
          cache: "no-store",
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const msg =
            res.status === 401
              ? "You must be logged in to export transactions."
              : text || `HTTP ${res.status}`;
          throw new ApiError(res.status, msg);
        }

        // Derive filename from Content-Disposition or build a default
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const match = disposition.match(/filename="([^"]+)"/);
        const filename =
          match?.[1] ??
          `transactions_export_${new Date().toISOString().slice(0, 10)}.${format}`;

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = objectUrl;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Export failed. Please try again.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { loading, error, exportTransactions };
}
