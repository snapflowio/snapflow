/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { type CreateAction, type HeaderAction, ResourceHeader } from "./resource-header";
import { type FilterTag, ResourceOptionsBar, type SearchConfig } from "./resource-options-bar";
import { type ResourceColumn, type ResourceRow, ResourceTable } from "./resource-table";

interface ResourceProps {
  icon?: LucideIcon;
  title: string;
  create?: CreateAction;
  search?: SearchConfig;
  defaultSort?: string;
  headerActions?: HeaderAction[];
  columns: ResourceColumn[];
  rows: ResourceRow[];
  selectedRowId?: string | null;
  onRowClick?: (id: string) => void;
  onRowHover?: (id: string) => void;
  onRowContextMenu?: (e: React.MouseEvent, id: string) => void;
  isLoading?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  filter?: ReactNode;
  filterTags?: FilterTag[];
  extras?: ReactNode;
  emptyMessage?: string;
  overlay?: ReactNode;
}

export function Resource({
  icon,
  title,
  create,
  search,
  defaultSort,
  headerActions,
  columns,
  rows,
  selectedRowId,
  onRowClick,
  onRowHover,
  onRowContextMenu,
  isLoading,
  onContextMenu,
  filter,
  filterTags,
  extras,
  emptyMessage,
  overlay,
}: ResourceProps) {
  return (
    <div
      className="flex h-full flex-1 flex-col overflow-hidden bg-bg"
      onContextMenu={onContextMenu}
    >
      <ResourceHeader icon={icon} title={title} create={create} actions={headerActions} />
      <ResourceOptionsBar search={search} filter={filter} filterTags={filterTags} extras={extras} />
      <ResourceTable
        columns={columns}
        rows={rows}
        defaultSort={defaultSort}
        selectedRowId={selectedRowId}
        onRowClick={onRowClick}
        onRowHover={onRowHover}
        onRowContextMenu={onRowContextMenu}
        isLoading={isLoading}
        create={create}
        emptyMessage={emptyMessage}
        overlay={overlay}
      />
    </div>
  );
}
