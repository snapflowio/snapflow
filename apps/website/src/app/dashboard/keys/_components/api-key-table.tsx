"use client";

import { useMemo, useState } from "react";
import { ApiKeyList, ApiKeyResponse, CreateApiKeyPermissionsEnum } from "@snapflow/api-client";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  KeyRound,
  Loader2,
} from "lucide-react";
import { Check } from "@/components/bootstrap/components/check";
import { ForEach } from "@/components/bootstrap/components/for-each";
import { CreateApiKeyDialog } from "@/components/dialogs/create-api-key-dialog";
import { Pagination } from "@/components/pagination";
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
  availablePermissions: CreateApiKeyPermissionsEnum[];
  onCreateApiKey: (
    name: string,
    permissions: CreateApiKeyPermissionsEnum[],
    expiresAt: Date | null
  ) => Promise<ApiKeyResponse | null>;
}

export function ApiKeyTable({
  data,
  loading,
  loadingKeys,
  onRevoke,
  availablePermissions,
  onCreateApiKey,
}: DataTableProps) {
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
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-shrink-0 flex-row items-center justify-between">
        <div>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Manage and create API keys for your organization.</CardDescription>
        </div>
        <CreateApiKeyDialog
          availablePermissions={availablePermissions}
          onCreateApiKey={onCreateApiKey}
        />
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <div className="flex h-full flex-col rounded-md border">
          <Table>
            <TableHeader>
              <ForEach items={table.getHeaderGroups()}>
                {(group) => (
                  <TableRow key={group.id}>
                    <ForEach items={group.headers}>
                      {(header) => (
                        <TableHead key={header.id} className="select-none py-1">
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
            <TableBody className="relative">
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
                              <TableCell key={cell.id} className="py-3">
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
                  <TableRow>
                    <TableCell colSpan={columns.length} className="relative h-[400px] p-0">
                      <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                        <KeyRound className="h-8 w-8 text-muted-foreground" />
                        <div className="text-center">
                          <h3 className="font-medium text-lg">No API Keys</h3>
                          <p className="mt-2 text-muted-foreground text-sm">
                            Use API keys with our SDK or with external programs.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </Check.Else>
              </Check>
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex-shrink-0">
        <Pagination table={table} entityName="API Keys" />
      </CardFooter>
    </Card>
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
    cell: ({ row }) => <div className="px-2 font-medium">{row.original.name}</div>,
  },
  {
    accessorKey: "value",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2 hover:bg-muted/50"
        >
          Key
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
    cell: ({ row }) => <span className="px-2">{row.original.value}</span>,
  },
  {
    accessorKey: "permissions",
    header: () => {
      return (
        <Button variant="ghost" className="cursor-default px-2">
          Permissions
        </Button>
      );
    },
    cell: ({ row }) => {
      const permissions = row.original.permissions.join(", ");
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="max-w-md cursor-text truncate px-2">{permissions || "-"}</div>
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
      const used = row.original.lastUsedAt;
      if (!used) return <span className="px-2">Never</span>;
      const relative = getRelativeTimeString(used).relativeTimeString;
      const full = new Date(used).toLocaleString();
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <span className="cursor-default px-2">{relative}</span>
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
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2 hover:bg-muted/50"
        >
          Expires
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
      const expires = row.original.expiresAt;
      if (!expires) return <span className="px-2">Never</span>;
      const relative = getRelativeTimeString(expires).relativeTimeString;
      const full = new Date(expires).toLocaleString();
      const color = getExpiresAtColor(expires);
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <span className={`cursor-default px-2 ${color}`}>{relative}</span>
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
