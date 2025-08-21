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
import {
  AlertTriangle,
  CheckCircle,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  HardDrive,
  MoreHorizontal,
  Timer,
} from "lucide-react";
import { CreateBucketDialog } from "@/components/dialogs/create-bucket-dialog";
import { Pagination } from "@/components/pagination";
import { DebouncedInput } from "@/components/table/debounce-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  onCreateBucket: (name: string) => Promise<void>;
  loadingCreate?: boolean;
}

export function BucketTable({
  data,
  loading,
  processingBucketAction,
  onDelete,
  onCreateBucket,
  loadingCreate = false,
}: BucketTableProps) {
  const { authenticatedUserHasPermission } = useSelectedOrganization();

  const deletePermitted = useMemo(
    () => authenticatedUserHasPermission(OrganizationRolePermissionsEnum.DELETE_SANDBOXES),
    [authenticatedUserHasPermission]
  );

  const writePermitted = useMemo(
    () => authenticatedUserHasPermission(OrganizationRolePermissionsEnum.WRITE_BUCKETS),
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
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-shrink-0 flex-row items-center justify-between">
        <div>
          <CardTitle>Buckets</CardTitle>
          <CardDescription>Manage & create storage buckets for your sandboxes</CardDescription>
        </div>
        {writePermitted && (
          <CreateBucketDialog
            onCreateBucket={onCreateBucket}
            loading={loadingCreate}
            disabled={loading}
          />
        )}
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <div className="flex h-full flex-col space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DebouncedInput
              value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
              onChange={(value) => table.getColumn("name")?.setFilterValue(value)}
              placeholder="Search buckets..."
              className="w-full sm:max-w-xs"
            />
          </div>

          <div className="min-h-0 flex-1 rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="select-none py-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="relative">
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
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="relative h-[400px] p-0">
                      <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                        <HardDrive className="h-10 w-10 text-muted-foreground" />
                        <div className="text-center">
                          <h3 className="font-medium text-lg">No Buckets found</h3>
                          <p className="mt-2 text-muted-foreground text-sm">
                            Buckets are shared directories for reusing datasets and caching files.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-shrink-0">
        <Pagination table={table} />
      </CardFooter>
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
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="px-2 hover:bg-muted/50"
          >
            Name
            {column.getIsSorted() === "asc" ? (
              <ChevronUpIcon className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDownIcon className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDownIcon className="ml-2 h-4 w-4" />
            )}
          </Button>
        );
      },
      cell: ({ row }) => {
        return <div className="w-40 px-2">{row.original.name}</div>;
      },
    },
    {
      id: "state",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="px-2 hover:bg-muted/50"
          >
            State
            {column.getIsSorted() === "asc" ? (
              <ChevronUpIcon className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDownIcon className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDownIcon className="ml-2 h-4 w-4" />
            )}
          </Button>
        );
      },
      cell: ({ row }) => {
        const bucket = row.original;
        const state = row.original.state;
        const color = getStateColor(state);

        if (state === BucketState.ERROR && !!bucket.errorReason) {
          return (
            <div className="px-2">
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
            </div>
          );
        }

        return (
          <div className="px-2">
            <Badge variant={"outline"} className="gap-2">
              {getStateIcon(bucket.state)}
              {getStateLabel(bucket.state)}
            </Badge>
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
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="px-2 hover:bg-muted/50"
          >
            Created
            {column.getIsSorted() === "asc" ? (
              <ChevronUpIcon className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDownIcon className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDownIcon className="ml-2 h-4 w-4" />
            )}
          </Button>
        );
      },
      cell: ({ row }) => {
        return (
          <span className="px-2">
            {getRelativeTimeString(row.original.createdAt).relativeTimeString}
          </span>
        );
      },
    },
    {
      accessorKey: "lastUsedAt",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="px-2 hover:bg-muted/50"
          >
            Last Used
            {column.getIsSorted() === "asc" ? (
              <ChevronUpIcon className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDownIcon className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDownIcon className="ml-2 h-4 w-4" />
            )}
          </Button>
        );
      },
      cell: ({ row }) => {
        return (
          <span className="px-2">
            {getRelativeTimeString(row.original.lastUsedAt).relativeTimeString}
          </span>
        );
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
