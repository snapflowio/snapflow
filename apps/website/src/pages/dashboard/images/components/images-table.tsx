import { useMemo, useState } from "react";
import { ImageDto, ImageState, OrganizationRolePermissionsEnum } from "@snapflow/api-client";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { AlertTriangle, Box, CheckCircle, Loader2, MoreHorizontal, Pause } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { TableEmptyState } from "@/components/table-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

const DISABLED_ROW_STATES: ImageState[] = [ImageState.REMOVING];

interface DataTableProps {
  data: ImageDto[];
  loading: boolean;
  loadingImages: Record<string, boolean>;
  onDelete: (image: ImageDto) => void;
  onToggleEnabled: (image: ImageDto, enabled: boolean) => void;
  onActivate?: (image: ImageDto) => void;
  pagination: {
    pageIndex: number;
    pageSize: number;
  };
  pageCount: number;
  onPaginationChange: (pagination: { pageIndex: number; pageSize: number }) => void;
}

export function ImageTable({
  data,
  loading,
  loadingImages,
  onDelete,
  onToggleEnabled,
  onActivate,
  pagination,
  pageCount,
  onPaginationChange,
}: DataTableProps) {
  const { authenticatedUserHasPermission } = useSelectedOrganization();

  const writePermitted = useMemo(
    () => authenticatedUserHasPermission(OrganizationRolePermissionsEnum.WRITE_IMAGES),
    [authenticatedUserHasPermission]
  );

  const deletePermitted = useMemo(
    () => authenticatedUserHasPermission(OrganizationRolePermissionsEnum.DELETE_IMAGES),
    [authenticatedUserHasPermission]
  );

  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () =>
      getColumns({
        onDelete,
        onToggleEnabled,
        onActivate,
        loadingImages,
        writePermitted,
        deletePermitted,
      }),
    [onDelete, onToggleEnabled, onActivate, loadingImages, writePermitted, deletePermitted]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: pageCount || 1,
    onPaginationChange: pagination
      ? (updater) => {
          const newPagination =
            typeof updater === "function" ? updater(table.getState().pagination) : updater;
          onPaginationChange(newPagination);
        }
      : undefined,
    state: {
      sorting,
      pagination: {
        pageIndex: pagination?.pageIndex || 0,
        pageSize: pagination?.pageSize || 10,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="px-4 py-3">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const isRowDisabled =
                  loadingImages[row.original.id] ||
                  DISABLED_ROW_STATES.includes(row.original.state) ||
                  row.original.general;
                return (
                  <TableRow
                    key={row.id}
                    data-state={isRowDisabled ? "disabled" : undefined}
                    className="data-[state=disabled]:pointer-events-none"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableEmptyState
                colSpan={columns.length}
                message="No images yet."
                icon={<Box className="h-8 w-8" />}
                description={
                  <p>
                    Images are reproducible, pre-configured environments based on any
                    Docker-compatible image. Use them to define language runtimes, dependencies, and
                    tools for your sandboxes.
                  </p>
                }
              />
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end">
        <Pagination table={table} entityName="Images" />
      </div>
    </div>
  );
}

const getColumns = ({
  onDelete,
  onToggleEnabled,
  onActivate,
  loadingImages,
  writePermitted,
  deletePermitted,
}: {
  onDelete: (image: ImageDto) => void;
  onToggleEnabled: (image: ImageDto, enabled: boolean) => void;
  onActivate?: (image: ImageDto) => void;
  loadingImages: Record<string, boolean>;
  writePermitted: boolean;
  deletePermitted: boolean;
}): ColumnDef<ImageDto>[] => {
  const columns: ColumnDef<ImageDto>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const image = row.original;
        return (
          <div className="font-medium">
            {image.name}
            {image.general && (
              <Badge variant={"outline"} className="ml-2">
                System
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "imageName",
      header: "Image",
      cell: ({ row }) => {
        const image = row.original;
        return image.imageName;
      },
    },
    {
      id: "resources",
      header: "Resources",
      cell: ({ row }) => {
        const image = row.original;
        return (
          <div className="flex flex-row items-center gap-2 text-background text-xs">
            <div className="rounded-sm bg-[#479DEC] p-1 px-2">{image.disk} GB</div>
            <div className="rounded-sm bg-primary p-1 px-2">{image.mem} GB</div>
            <div className="rounded-sm bg-[#FA3ABF] p-1 px-2">{image.cpu} vCPU</div>
          </div>
        );
      },
    },
    {
      accessorKey: "state",
      header: "State",
      cell: ({ row }) => {
        const image = row.original;

        if (
          (image.state === ImageState.ERROR || image.state === ImageState.BUILD_FAILED) &&
          !!image.errorReason
        ) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant={"outline"} className="gap-2">
                    {getStateIcon(image.state)}
                    {getStateLabel(image.state)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-[300px]">{image.errorReason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }

        return (
          <Badge variant={"outline"} className="gap-2">
            {getStateIcon(image.state)}
            {getStateLabel(image.state)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => {
        const image = row.original;
        return image.general
          ? "—"
          : getRelativeTimeString(image.createdAt).relativeTimeString || "Never";
      },
    },
    {
      accessorKey: "lastUsedAt",
      header: "Last Used",
      cell: ({ row }) => {
        const image = row.original;
        return image.general
          ? "—"
          : getRelativeTimeString(image.lastUsedAt).relativeTimeString || "Never";
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        if ((!writePermitted && !deletePermitted) || row.original.general) {
          return null;
        }

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {writePermitted && onActivate && row.original.state === ImageState.INACTIVE && (
                  <DropdownMenuItem
                    onClick={() => onActivate(row.original)}
                    className="cursor-pointer"
                    disabled={loadingImages[row.original.id]}
                  >
                    Activate
                  </DropdownMenuItem>
                )}
                {writePermitted && (
                  <DropdownMenuItem
                    onClick={() => onToggleEnabled(row.original, !row.original.enabled)}
                    className="cursor-pointer"
                    disabled={loadingImages[row.original.id]}
                  >
                    {row.original.enabled ? "Disable" : "Enable"}
                  </DropdownMenuItem>
                )}
                {deletePermitted && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(row.original)}
                      className="cursor-pointer text-red-600"
                      disabled={loadingImages[row.original.id]}
                    >
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return columns;
};

const getStateIcon = (state: ImageState) => {
  const className = "h-4 w-4 flex-shrink-0";
  switch (state) {
    case ImageState.ACTIVE:
      return <CheckCircle className={className} />;
    case ImageState.INACTIVE:
      return <Pause className={className} />;
    case ImageState.ERROR:
    case ImageState.BUILD_FAILED:
      return <AlertTriangle className={className} />;
    default:
      return <Loader2 className={`${className} animate-spin`} />;
  }
};

const getStateLabel = (state: ImageState) => {
  if (state === ImageState.REMOVING) return "Deleting";

  return state
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};
