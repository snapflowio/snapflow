/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { memo, type ReactNode, useCallback, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { CreateAction } from "./resource-header";

export interface ResourceColumn {
  id: string;
  header: string;
  widthMultiplier?: number;
}

export interface ResourceCell {
  icon?: ReactNode;
  label?: string | null;
  content?: ReactNode;
}

export interface ResourceRow {
  id: string;
  cells: Record<string, ResourceCell>;
  sortValues?: Record<string, string | number>;
  className?: string;
}

interface ResourceTableProps {
  columns: ResourceColumn[];
  rows: ResourceRow[];
  defaultSort?: string;
  selectedRowId?: string | null;
  onRowClick?: (id: string) => void;
  onRowHover?: (id: string) => void;
  onRowContextMenu?: (e: React.MouseEvent, id: string) => void;
  isLoading?: boolean;
  create?: CreateAction;
  emptyMessage?: string;
  overlay?: ReactNode;
}

const EMPTY_CELL_PLACEHOLDER = "-  -  -";
const SKELETON_ROW_COUNT = 5;

function ResourceColGroup({ columns }: { columns: ResourceColumn[] }) {
  const totalWeight = columns.reduce((sum, col) => sum + (col.widthMultiplier ?? 1), 0);
  return (
    <colgroup>
      {columns.map((col) => {
        const weight = col.widthMultiplier ?? 1;
        const pct = (weight / totalWeight) * 100;
        return <col key={col.id} style={{ width: `${pct}%` }} />;
      })}
    </colgroup>
  );
}

function CellContent({ cell, primary }: { cell: ResourceCell; primary?: boolean }) {
  if (cell.content) return <>{cell.content}</>;
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-3 font-medium text-[14px]",
        primary ? "text-text-body" : "text-text-secondary"
      )}
    >
      {cell.icon && <span className="shrink-0 text-text-icon">{cell.icon}</span>}
      <span className="truncate">{cell.label || EMPTY_CELL_PLACEHOLDER}</span>
    </span>
  );
}

function DataTableSkeleton({ columns }: { columns: ResourceColumn[] }) {
  return (
    <>
      {/* Skeleton header */}
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-[13px]">
          <ResourceColGroup columns={columns} />
          <thead className="shadow-[inset_0_-1px_0_var(--border)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="h-10 px-6 py-2.5 text-left align-middle font-(--font-weight-base) text-text-muted"
                >
                  <div className="flex min-h-5 items-center">
                    <Skeleton className="h-3 w-14" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>
      {/* Skeleton body */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed text-[13px]">
          <ResourceColGroup columns={columns} />
          <tbody>
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
              <tr key={i}>
                {columns.map((col, colIdx) => (
                  <td key={col.id} className="px-6 py-2.5 align-middle">
                    <span className="flex min-h-5.25 items-center gap-3">
                      {colIdx === 0 && <Skeleton className="h-3.5 w-3.5 rounded-sm" />}
                      <Skeleton className="h-3 w-32" />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export const ResourceTable = memo(function ResourceTable({
  columns,
  rows,
  defaultSort,
  selectedRowId,
  onRowClick,
  onRowHover,
  onRowContextMenu,
  isLoading,
  create,
  emptyMessage,
  overlay,
}: ResourceTableProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const sortEnabled = defaultSort != null;
  const [sort, setSort] = useState<{ column: string; direction: "asc" | "desc" }>({
    column: defaultSort ?? "",
    direction: "desc",
  });

  const handleSort = useCallback((column: string, direction: "asc" | "desc") => {
    setSort({ column, direction });
  }, []);

  const handleBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, []);

  const displayRows = sortEnabled
    ? [...rows].sort((a, b) => {
        const aVal = a.sortValues?.[sort.column] ?? 0;
        const bVal = b.sortValues?.[sort.column] ?? 0;
        if (typeof aVal === "string" && typeof bVal === "string")
          return sort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        return sort.direction === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
      })
    : rows;

  // Loading: show skeleton
  if (isLoading) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTableSkeleton columns={columns} />
      </div>
    );
  }

  // Empty: show message centered, but still show create row if available
  if (rows.length === 0 && !create) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <span className="text-[13px] text-text-secondary">{emptyMessage || "No results"}</span>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div ref={headerRef} className="overflow-hidden">
        <table className="w-full table-fixed text-[13px]">
          <ResourceColGroup columns={columns} />
          <thead className="shadow-[inset_0_-1px_0_var(--border)]">
            <tr>
              {columns.map((col) => {
                if (!sortEnabled) {
                  return (
                    <th
                      key={col.id}
                      className="h-10 px-6 py-1.5 text-left align-middle font-(--font-weight-base) text-[12px] text-text-muted"
                    >
                      {col.header}
                    </th>
                  );
                }
                const isActive = sort.column === col.id;
                const SortIcon = sort.direction === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th key={col.id} className="h-10 px-4 py-1.5 text-left align-middle">
                    <Button
                      variant="subtle"
                      className="px-2 py-1 font-(--font-weight-base) text-text-muted hover:text-text-muted"
                      onClick={() =>
                        handleSort(
                          col.id,
                          isActive ? (sort.direction === "desc" ? "asc" : "desc") : "desc"
                        )
                      }
                    >
                      {col.header}
                      {isActive && <SortIcon className="ml-1 h-3 w-3 text-text-icon" />}
                    </Button>
                  </th>
                );
              })}
            </tr>
          </thead>
        </table>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto" onScroll={handleBodyScroll}>
        <table className="w-full table-fixed text-[13px]">
          <ResourceColGroup columns={columns} />
          <tbody>
            {displayRows.map((row) => (
              <tr
                key={row.id}
                data-resource-row
                data-row-id={row.id}
                className={cn(
                  "transition-colors hover:bg-surface-3",
                  onRowClick && "cursor-pointer",
                  selectedRowId === row.id && "bg-surface-3",
                  row.className
                )}
                onClick={() => onRowClick?.(row.id)}
                onMouseEnter={onRowHover ? () => onRowHover(row.id) : undefined}
                onContextMenu={(e) => onRowContextMenu?.(e, row.id)}
              >
                {columns.map((col, colIdx) => {
                  const cell = row.cells[col.id] ?? { label: null };
                  return (
                    <td key={col.id} className="px-6 py-2.5 align-middle">
                      <CellContent
                        cell={{ ...cell, label: cell.label || EMPTY_CELL_PLACEHOLDER }}
                        primary={colIdx === 0}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {create && (
              <tr
                className={cn(
                  "transition-colors",
                  create.disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-surface-3"
                )}
                onClick={create.disabled ? undefined : create.onClick}
              >
                <td colSpan={columns.length} className="px-6 py-2.5 align-middle">
                  <span className="flex items-center gap-3 font-medium text-[14px] text-text-secondary">
                    <Plus className="h-3.5 w-3.5 text-text-subtle" />
                    {create.label}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {overlay}
    </div>
  );
});
