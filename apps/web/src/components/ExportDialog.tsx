"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useExport, ExportFilters, ExportFormat } from "@/hooks/useExport";
import { Category } from "@/lib/api";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Available categories for the category filter dropdown. */
  categories?: Category[];
  /** Called when the export completes successfully. */
  onSuccess?: (format: ExportFormat) => void;
}

/**
 * Modal dialog that lets the user choose a format (CSV or PDF) and
 * optional filters (date range, category, amount range) before exporting
 * their transactions.
 */
export function ExportDialog({
  isOpen,
  onClose,
  categories = [],
  onSuccess,
}: ExportDialogProps) {
  const { loading, error, exportTransactions } = useExport();

  const [format, setFormat] = useState<ExportFormat>("csv");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [amountMin, setAmountMin] = useState<string>("");
  const [amountMax, setAmountMax] = useState<string>("");

  async function handleExport() {
    const filters: ExportFilters = {};
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (categoryId) filters.category_id = Number(categoryId);
    const parsedMin = amountMin !== "" ? parseFloat(amountMin) : NaN;
    const parsedMax = amountMax !== "" ? parseFloat(amountMax) : NaN;
    if (!isNaN(parsedMin)) filters.amount_min = parsedMin;
    if (!isNaN(parsedMax)) filters.amount_max = parsedMax;

    try {
      await exportTransactions(format, filters);
      onSuccess?.(format);
      onClose();
    } catch {
      // error state handled by useExport
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Transactions" maxWidth="max-w-lg">
      <div className="space-y-6">
        {/* Format selector */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Export Format
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["csv", "pdf"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`py-3 rounded-xl border text-sm font-semibold transition-all ${
                  format === f
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-[0_0_16px_rgba(99,102,241,0.4)]"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                }`}
                aria-pressed={format === f}
              >
                {f === "csv" ? "📄 CSV" : "📋 PDF"}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1" htmlFor="export-date-from">
              From date
            </label>
            <input
              id="export-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-black/40 border border-white/10 focus:border-indigo-500/50 py-2.5 px-3 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1" htmlFor="export-date-to">
              To date
            </label>
            <input
              id="export-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-black/40 border border-white/10 focus:border-indigo-500/50 py-2.5 px-3 rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div>
            <label
              className="block text-xs font-medium text-white/60 mb-1"
              htmlFor="export-category"
            >
              Category (optional)
            </label>
            <select
              id="export-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 focus:border-indigo-500/50 py-2.5 px-3 rounded-xl text-sm"
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Amount range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1" htmlFor="export-amount-min">
              Min amount
            </label>
            <input
              id="export-amount-min"
              type="number"
              min="0"
              step="0.01"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              placeholder="0.00"
              className="w-full bg-black/40 border border-white/10 focus:border-indigo-500/50 py-2.5 px-3 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1" htmlFor="export-amount-max">
              Max amount
            </label>
            <input
              id="export-amount-max"
              type="number"
              min="0"
              step="0.01"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              placeholder="No limit"
              className="w-full bg-black/40 border border-white/10 focus:border-indigo-500/50 py-2.5 px-3 rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            aria-busy={loading}
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Exporting…
              </>
            ) : (
              `Export ${format.toUpperCase()}`
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
