"use client";

import { useMemo, useState } from "react";
import { BucketDto, BucketState, OrganizationRolePermissionsEnum } from "@snapflow/api-client";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { AlertTriangle, CheckCircle, HardDrive, MoreHorizontal, Timer } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { DebouncedInput } from "@/components/table/debounce-input";
import { TableEmptyState } from "@/components/table/table-empty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

interface BucketTableProps {
  data: BucketDto[];
  loading: boolean;
  processingBucketAction: Record<string, boolean>;
  onDelete: (bucket: BucketDto) => void;
}

export function BucketTable({ data, loading, processingBucketAction, onDelete }: BucketTableProps) {
  const { authenticatedUserHasPermission } = useSelectedOrganization();

  const deletePermitted = useMemo(
    () => authenticatedUserHasPermission(OrganizationRolePermissionsEnum.DELETE_SANDBOXES),
    [authenticatedUserHasPermission]
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const columns = getColumns({
    onDelete,
    processingBucketAction,
    deletePermitted,
  });
  const table = useReactTable({
    data,
    columns,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageSize: DEFAULT_PAGE_SIZE,
      },
    },
  });

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Buckets</CardTitle>
        <CardDescription>Manage & create storage buckets for your sandboxes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DebouncedInput
              value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
              onChange={(value) => table.getColumn("name")?.setFilterValue(value)}
              placeholder="Search buckets..."
              className="w-full sm:max-w-xs"
            />
          </div>

          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="py-3">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    Loading buckets...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => {
                  return (
                    <TableRow
                      key={row.id}
                      className={`${processingBucketAction[row.original.id] || row.original.state === BucketState.PENDING_DELETE || row.original.state === BucketState.DELETING ? "pointer-events-none opacity-50" : ""}`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableEmptyState
                  colSpan={columns.length}
                  icon={<HardDrive className="h-10 w-10 text-muted-foreground" />}
                  message="No Buckets found"
                  description="Buckets are shared directories for reusing datasets and caching files."
                />
              )}
            </TableBody>
          </Table>
          <Pagination table={table} />
        </div>
      </CardContent>
    </Card>
  );
}

const getStateIcon = (state: BucketState) => {
  switch (state) {
    case BucketState.READY:
      return <CheckCircle className="h-4 w-4 flex-shrink-0" />;
    case BucketState.ERROR:
      return <AlertTriangle className="h-4 w-4 flex-shrink-0" />;
    default:
      return <Timer className="h-4 w-4 flex-shrink-0" />;
  }
};

const getStateColor = (state: BucketState) => {
  switch (state) {
    case BucketState.READY:
      return "text-green-500";
    case BucketState.ERROR:
      return "text-red-500";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
};

const getStateLabel = (state: BucketState) => {
  return state
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const getColumns = ({
  onDelete,
  processingBucketAction,
  deletePermitted,
}: {
  onDelete: (bucket: BucketDto) => void;
  processingBucketAction: Record<string, boolean>;
  deletePermitted: boolean;
}): ColumnDef<BucketDto>[] => {
  const columns: ColumnDef<BucketDto>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        return <div className="w-40">{row.original.name}</div>;
      },
    },
    {
      id: "state",
      header: "State",
      cell: ({ row }) => {
        const bucket = row.original;
        const state = row.original.state;
        const color = getStateColor(state);

        if (state === BucketState.ERROR && !!bucket.errorReason) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className={`flex items-center gap-2 ${color}`}>
                    {getStateIcon(state)}
                    {getStateLabel(state)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-[300px]">{bucket.errorReason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }

        return (
          <div className={`flex w-40 items-center gap-2 ${color}`}>
            {getStateIcon(state)}
            <span>{getStateLabel(state)}</span>
          </div>
        );
      },
      accessorKey: "state",
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => {
        return getRelativeTimeString(row.original.createdAt).relativeTimeString;
      },
    },
    {
      accessorKey: "lastUsedAt",
      header: "Last Used",
      cell: ({ row }) => {
        return getRelativeTimeString(row.original.lastUsedAt).relativeTimeString;
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        if (!deletePermitted) {
          return null;
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className={`cursor-pointer text-red-600 dark:text-red-400 ${
                  processingBucketAction[row.original.id] ? "pointer-events-none opacity-50" : ""
                }`}
                disabled={processingBucketAction[row.original.id]}
                onClick={() => onDelete(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return columns;
};
