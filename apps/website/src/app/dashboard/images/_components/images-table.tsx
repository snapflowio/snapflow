"use client";

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
import {
  AlertTriangle,
  Box,
  CheckCircle,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  Loader2Icon,
  MoreHorizontal,
  Pause,
} from "lucide-react";
import { CreateImageDialog } from "@/components/dialogs/create-image-dialog";
import { Pagination } from "@/components/pagination";
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
  onCreateImage: (data: {
    name: string;
    imageName: string;
    entrypoint?: string[];
    cpu?: number;
    memory?: number;
    disk?: number;
  }) => Promise<void>;
  loadingCreate?: boolean;
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
  onCreateImage,
  loadingCreate = false,
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
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-shrink-0 flex-row items-center justify-between">
        <div>
          <CardTitle>Images</CardTitle>
          <CardDescription>Manage & create your sandbox system images</CardDescription>
        </div>
        {writePermitted && (
          <CreateImageDialog
            onCreateImage={onCreateImage}
            loading={loadingCreate}
            disabled={loading}
          />
        )}
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <div className="flex h-full flex-col rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="select-none py-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="relative">
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
                        <TableCell key={cell.id} className="py-3">
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
                      <Box className="h-8 w-8 text-muted-foreground" />
                      <div className="text-center">
                        <h3 className="font-medium text-lg">No images yet.</h3>
                        <p className="mt-2 text-muted-foreground text-sm">
                          Images are reproducible, pre-configured environments based on any
                          Docker-compatible image. Use them to define language runtimes,
                          dependencies, and tools for your sandboxes.
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex-shrink-0">
        <Pagination table={table} entityName="Images" />
      </CardFooter>
    </Card>
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
        const image = row.original;
        return (
          <div className="px-2 font-medium">
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
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="px-2 hover:bg-muted/50"
          >
            Image
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
        const image = row.original;
        return <span className="px-2">{image.imageName}</span>;
      },
    },
    {
      id: "resources",
      header: () => {
        return (
          <Button variant="ghost" className="cursor-default px-2">
            Resources
          </Button>
        );
      },
      cell: ({ row }) => {
        const image = row.original;
        return (
          <div className="flex flex-row items-center gap-2 px-2 text-background text-xs">
            <div className="rounded-sm bg-primary p-1 px-2 text-[9px]">{image.disk} GB</div>
            <div className="rounded-sm bg-primary p-1 px-2 text-[9px]">{image.mem} GB RAM</div>
            <div className="rounded-sm bg-primary p-1 px-2 text-[9px]">{image.cpu} vCPU</div>
          </div>
        );
      },
    },
    {
      accessorKey: "state",
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
        const image = row.original;

        if (
          (image.state === ImageState.ERROR || image.state === ImageState.BUILD_FAILED) &&
          !!image.errorReason
        ) {
          return (
            <div className="px-2">
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
            </div>
          );
        }

        return (
          <div className="px-2">
            <Badge variant={"outline"} className="gap-2">
              {getStateIcon(image.state)}
              {getStateLabel(image.state)}
            </Badge>
          </div>
        );
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
        const image = row.original;
        return (
          <span className="px-2">
            {image.general
              ? "—"
              : getRelativeTimeString(image.createdAt).relativeTimeString || "Never"}
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
        const image = row.original;
        return (
          <span className="px-2">
            {image.general
              ? "—"
              : getRelativeTimeString(image.lastUsedAt).relativeTimeString || "Never"}
          </span>
        );
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
      return <Loader2Icon className={`${className} animate-spin`} />;
  }
};

const getStateLabel = (state: ImageState) => {
  if (state === ImageState.REMOVING) return "Deleting";

  return state
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};
