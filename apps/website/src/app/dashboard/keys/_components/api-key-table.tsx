"use client";

import { useMemo, useState } from "react";
import { ApiKeyList } from "@snapflow/api-client";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { KeyRound, Loader2 } from "lucide-react";
import { Check } from "@/components/bootstrap/components/check";
import { ForEach } from "@/components/bootstrap/components/for-each";
import { Pagination } from "@/components/pagination";
import { TableEmptyState } from "@/components/table/table-empty";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getRelativeTimeString } from "@/lib/util";
import { DEFAULT_PAGE_SIZE } from "@/constants/pagination";

interface DataTableProps {
  data: ApiKeyList[];
  loading: boolean;
  loadingKeys: Record<string, boolean>;
  onRevoke: (keyName: string) => void;
}

export function ApiKeyTable({ data, loading, loadingKeys, onRevoke }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo(() => getColumns({ onRevoke, loadingKeys }), [onRevoke, loadingKeys]);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    initialState: { pagination: { pageSize: DEFAULT_PAGE_SIZE } },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <ForEach items={table.getHeaderGroups()}>
              {(group) => (
                <TableRow key={group.id}>
                  <ForEach items={group.headers}>
                    {(header) => (
                      <TableHead key={header.id} className="px-4 py-3">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )}
                  </ForEach>
                </TableRow>
              )}
            </ForEach>
          </TableHeader>
          <TableBody>
            <Check>
              <Check.When condition={loading}>
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    Loading API Keys...
                  </TableCell>
                </TableRow>
              </Check.When>
              <Check.When condition={table.getRowModel().rows.length > 0}>
                <ForEach items={table.getRowModel().rows}>
                  {(row) => {
                    const isDisabled = loadingKeys[row.original.name];
                    return (
                      <TableRow
                        key={row.id}
                        data-state={isDisabled ? "disabled" : undefined}
                        className="data-[state=disabled]:pointer-events-none data-[state=disabled]:opacity-50"
                      >
                        <ForEach items={row.getVisibleCells()}>
                          {(cell) => (
                            <TableCell key={cell.id} className="px-4 py-3">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          )}
                        </ForEach>
                      </TableRow>
                    );
                  }}
                </ForEach>
              </Check.When>
              <Check.Else>
                <TableEmptyState
                  colSpan={columns.length}
                  icon={<KeyRound className="h-8 w-8 text-muted-foreground" />}
                  message="No API Keys"
                  description="Use API keys with our SDK or with external programs."
                />
              </Check.Else>
            </Check>
          </TableBody>
        </Table>
      </div>
      <Pagination table={table} className="mt-2" entityName="API Keys" />
    </div>
  );
}

const getExpiresAtColor = (expiresAt: Date | null) => {
  if (!expiresAt) return "text-foreground";
  const now = Date.now();
  const diff = new Date(expiresAt).getTime() - now;
  if (diff < 0) return "text-red-500";
  if (diff < 1000 * 60 * 60 * 24) return "text-yellow-600 dark:text-yellow-400";
  return "text-foreground";
};

const getColumns = ({
  onRevoke,
  loadingKeys,
}: {
  onRevoke: (keyName: string) => void;
  loadingKeys: Record<string, boolean>;
}): ColumnDef<ApiKeyList>[] => [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
  },
  {
    accessorKey: "value",
    header: "Key",
  },
  {
    accessorKey: "permissions",
    header: "Permissions",
    cell: ({ row }) => {
      const permissions = row.original.permissions.join(", ");
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="max-w-md cursor-text truncate px-1">{permissions || "-"}</div>
            </TooltipTrigger>
            {permissions && (
              <TooltipContent>
                <p className="max-w-[300px]">{permissions}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    accessorKey: "lastUsedAt",
    header: "Last Used",
    cell: ({ row }) => {
      const used = row.original.lastUsedAt;
      if (!used) return "Never";
      const relative = getRelativeTimeString(used).relativeTimeString;
      const full = new Date(used).toLocaleString();
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <span className="cursor-default">{relative}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{full}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    accessorKey: "expiresAt",
    header: "Expires",
    cell: ({ row }) => {
      const expires = row.original.expiresAt;
      if (!expires) return "Never";
      const relative = getRelativeTimeString(expires).relativeTimeString;
      const full = new Date(expires).toLocaleString();
      const color = getExpiresAtColor(expires);
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <span className={`cursor-default ${color}`}>{relative}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{full}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const key = row.original.name;
      const isLoading = loadingKeys[key];
      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={isLoading} className="w-20">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoke"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Key Revocation</DialogTitle>
              <DialogDescription>
                This will permanently delete the API key. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="destructive" onClick={() => onRevoke(key)}>
                  Revoke
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    },
  },
];
