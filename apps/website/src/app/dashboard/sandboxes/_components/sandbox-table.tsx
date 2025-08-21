"use client";

import { useMemo, useState } from "react";
import { OrganizationRolePermissionsEnum, Sandbox, SandboxState } from "@snapflow/api-client";
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
  Archive,
  ArchiveIcon,
  BoxIcon,
  CheckCircle,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  Circle,
  MoreHorizontal,
  PlayIcon,
  StopCircleIcon,
  TerminalIcon,
  Timer,
} from "lucide-react";
import { Check } from "@/components/bootstrap/components/check";
import { ForEach } from "@/components/bootstrap/components/for-each";
import { Switch } from "@/components/bootstrap/components/switch-case";
import { Whenever } from "@/components/bootstrap/components/whenever";
import { Pagination } from "@/components/pagination";
import { DebouncedInput } from "@/components/table/debounce-input";
import { DataTableFacetedFilter, FacetedFilterOption } from "@/components/table/table-filter";
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
import { DEFAULT_PAGE_SIZE } from "@/constants/pagination";
import { env } from "@/env";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

interface DataTableProps {
  data: Sandbox[];
  loadingSandboxes: Record<string, boolean>;
  loading: boolean;
  handleStart: (id: string) => void;
  handleStop: (id: string) => void;
  handleDelete: (id: string) => void;
  handleArchive: (id: string) => void;
}

export function SandboxTable({
  data,
  loadingSandboxes,
  loading,
  handleStart,
  handleStop,
  handleDelete,
  handleArchive,
}: DataTableProps) {
  const { authenticatedUserHasPermission } = useSelectedOrganization();

  const writePermitted = useMemo(
    () => authenticatedUserHasPermission(OrganizationRolePermissionsEnum.WRITE_SANDBOXES),
    [authenticatedUserHasPermission]
  );

  const deletePermitted = useMemo(
    () => authenticatedUserHasPermission(OrganizationRolePermissionsEnum.DELETE_SANDBOXES),
    [authenticatedUserHasPermission]
  );

  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "state",
      desc: false,
    },
    {
      id: "lastEvent",
      desc: true,
    },
  ]);

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const labelOptions: FacetedFilterOption[] = useMemo(() => {
    const labels = new Set<string>();
    data.forEach((sandbox) => {
      Object.entries(sandbox.labels ?? {}).forEach(([key, value]) => {
        labels.add(`${key}: ${value}`);
      });
    });

    return Array.from(labels).map((label) => ({ label, value: label }));
  }, [data]);

  const columns = getColumns({
    handleStart,
    handleStop,
    handleDelete,
    handleArchive,
    loadingSandboxes,
    writePermitted,
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
          <CardTitle>Sandboxes</CardTitle>
          <CardDescription>Manage & create your sandboxes</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <div className="flex h-full flex-col space-y-4">
          <div className="flex items-center">
            <DebouncedInput
              value={(table.getColumn("id")?.getFilterValue() as string) ?? ""}
              onChange={(value) => table.getColumn("id")?.setFilterValue(value)}
              placeholder="Search..."
              className="mr-4 max-w-sm"
            />
            {table.getColumn("state") && (
              <DataTableFacetedFilter
                column={table.getColumn("state")}
                title="State"
                options={statuses}
              />
            )}
            {table.getColumn("labels") && (
              <DataTableFacetedFilter
                className="ml-4"
                column={table.getColumn("labels")}
                title="Labels"
                options={labelOptions}
              />
            )}
          </div>

          <div className="min-h-0 flex-1 rounded-md border">
            <Table>
              <TableHeader>
                <ForEach items={table.getHeaderGroups()}>
                  {(headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      <ForEach items={headerGroup.headers}>
                        {(header) => (
                          <TableHead className="select-none py-1" key={header.id}>
                            <Whenever condition={!header.isPlaceholder}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </Whenever>
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
                        Loading...
                      </TableCell>
                    </TableRow>
                  </Check.When>
                  <Check.When condition={table.getRowModel().rows?.length > 0}>
                    <ForEach items={table.getRowModel().rows}>
                      {(row) => (
                        <TableRow
                          key={row.id}
                          className={`${loadingSandboxes[row.original.id] || row.original.state === SandboxState.DESTROYING ? "pointer-events-none opacity-50" : ""}`}
                        >
                          <ForEach items={row.getVisibleCells()}>
                            {(cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            )}
                          </ForEach>
                        </TableRow>
                      )}
                    </ForEach>
                  </Check.When>
                  <Check.Else>
                    <TableRow>
                      <TableCell colSpan={columns.length} className="relative h-[400px] p-0">
                        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                          <BoxIcon className="h-8 w-8 text-muted-foreground" />
                          <div className="text-center">
                            <h3 className="font-medium text-lg">No sandboxes</h3>
                            <div className="mt-2 space-y-2 text-muted-foreground text-sm">
                              <p>Sandboxes are used to run code in a safe environment</p>
                              <p>Manually create one to experiment or use our SDK to create one.</p>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </Check.Else>
                </Check>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-shrink-0">
        <Pagination table={table} entityName="Sandboxes" />
      </CardFooter>
    </Card>
  );
}

const getStateIcon = (state?: SandboxState) => (
  <Switch match={state}>
    <Switch.Case value={SandboxState.STARTED}>
      <CheckCircle className="h-4 w-4" />
    </Switch.Case>
    <Switch.Case value={SandboxState.STOPPED}>
      <Circle className="h-4 w-4" />
    </Switch.Case>
    <Switch.Case value={[SandboxState.ERROR, SandboxState.BUILD_FAILED]}>
      <AlertTriangle className="h-4 w-4" />
    </Switch.Case>
    <Switch.Case
      value={[
        SandboxState.CREATING,
        SandboxState.STARTING,
        SandboxState.STOPPING,
        SandboxState.DESTROYING,
        SandboxState.ARCHIVING,
      ]}
    >
      <Timer className="h-4 w-4" />
    </Switch.Case>
    <Switch.Case value={SandboxState.ARCHIVED}>
      <Archive className="h-4 w-4" />
    </Switch.Case>
    <Switch.Default>{null}</Switch.Default>
  </Switch>
);

const getLastEvent = (sandbox: Sandbox): { date: Date; relativeTimeString: string } => {
  return getRelativeTimeString(sandbox.updatedAt);
};

const getCreatedAt = (sandbox: Sandbox): { date: Date; relativeTimeString: string } => {
  return getRelativeTimeString(sandbox.createdAt);
};

const getStateColor = (state?: SandboxState) => (
  <Switch match={state}>
    <Switch.Case value={SandboxState.STARTED}>"text-green-500"</Switch.Case>
    <Switch.Case value={SandboxState.STOPPED}>"text-gray-500"</Switch.Case>
    <Switch.Case value={[SandboxState.ERROR, SandboxState.BUILD_FAILED]}>
      "text-red-500"
    </Switch.Case>
    <Switch.Default>"text-gray-600 dark:text-gray-400"</Switch.Default>
  </Switch>
);

const getStateLabel = (state?: SandboxState) => {
  if (!state) return "Unknown";
  if (state === SandboxState.DESTROYING) return "Deleting";

  return state
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const statuses: FacetedFilterOption[] = [
  {
    label: getStateLabel(SandboxState.STARTED),
    value: SandboxState.STARTED,
    icon: CheckCircle,
  },
  {
    label: getStateLabel(SandboxState.STOPPED),
    value: SandboxState.STOPPED,
    icon: Circle,
  },
  {
    label: getStateLabel(SandboxState.ERROR),
    value: SandboxState.ERROR,
    icon: AlertTriangle,
  },
  {
    label: getStateLabel(SandboxState.BUILD_FAILED),
    value: SandboxState.BUILD_FAILED,
    icon: AlertTriangle,
  },
  {
    label: getStateLabel(SandboxState.STARTING),
    value: SandboxState.STARTING,
    icon: Timer,
  },
  {
    label: getStateLabel(SandboxState.STOPPING),
    value: SandboxState.STOPPING,
    icon: Timer,
  },
  {
    label: getStateLabel(SandboxState.DESTROYING),
    value: SandboxState.DESTROYING,
    icon: Timer,
  },
  {
    label: getStateLabel(SandboxState.ARCHIVING),
    value: SandboxState.ARCHIVING,
    icon: Timer,
  },
  {
    label: getStateLabel(SandboxState.ARCHIVED),
    value: SandboxState.ARCHIVED,
    icon: Archive,
  },
];

const getColumns = ({
  handleStart,
  handleStop,
  handleDelete,
  handleArchive,
  writePermitted,
  deletePermitted,
}: {
  handleStart: (id: string) => void;
  handleStop: (id: string) => void;
  handleDelete: (id: string) => void;
  handleArchive: (id: string) => void;
  loadingSandboxes: Record<string, boolean>;
  writePermitted: boolean;
  deletePermitted: boolean;
}): ColumnDef<Sandbox>[] => {
  const columns: ColumnDef<Sandbox>[] = [
    {
      id: "id",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="px-2 hover:bg-muted/50"
          >
            ID
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
      accessorKey: "id",
      cell: ({ row }) => {
        return <span className="px-2">{row.original.id}</span>;
      },
    },
    {
      id: "state",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="w-24 justify-start px-2 hover:bg-muted/50"
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
        const sandbox = row.original;
        const state = row.original.state;
        const color = getStateColor(state);

        if (
          (state === SandboxState.ERROR || state === SandboxState.BUILD_FAILED) &&
          !!sandbox.errorReason
        ) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className={`flex items-center gap-2 px-2 ${color}`}>
                    {getStateIcon(state)}
                    {getStateLabel(state)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-[300px]">{sandbox.errorReason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }

        return (
          <div className={`flex w-24 items-center gap-2 px-2 ${color}`}>
            {getStateIcon(state)}
            <span>{getStateLabel(state)}</span>
          </div>
        );
      },
      accessorKey: "state",
      sortingFn: (rowA, rowB) => {
        const statePriorityOrder = {
          [SandboxState.STARTED]: 1,
          [SandboxState.BUILDING_IMAGE]: 2,
          [SandboxState.PENDING_BUILD]: 2,
          [SandboxState.RESTORING]: 3,
          [SandboxState.ERROR]: 4,
          [SandboxState.BUILD_FAILED]: 4,
          [SandboxState.STOPPED]: 5,
          [SandboxState.ARCHIVING]: 6,
          [SandboxState.ARCHIVED]: 6,
          [SandboxState.CREATING]: 7,
          [SandboxState.STARTING]: 7,
          [SandboxState.STOPPING]: 7,
          [SandboxState.DESTROYING]: 7,
          [SandboxState.DESTROYED]: 7,
          [SandboxState.PULLING_IMAGE]: 7,
          [SandboxState.UNKNOWN]: 7,
        };

        const stateA = rowA.original.state || SandboxState.UNKNOWN;
        const stateB = rowB.original.state || SandboxState.UNKNOWN;

        if (stateA === stateB) {
          return 0;
        }

        return statePriorityOrder[stateA] - statePriorityOrder[stateB];
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      id: "region",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="px-2 hover:bg-muted/50"
          >
            Region
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
        return <span className="px-2">{row.original.target}</span>;
      },
      accessorKey: "target",
    },
    {
      id: "labels",
      header: () => {
        return (
          <Button variant="ghost" className="cursor-default px-2">
            Labels
          </Button>
        );
      },
      cell: ({ row }) => {
        const labels = Object.entries(row.original.labels ?? {})
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="max-w-md cursor-text truncate px-2">{labels || "-"}</div>
              </TooltipTrigger>
              {labels && (
                <TooltipContent>
                  <p className="max-w-[300px]">{labels}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        );
      },
      accessorFn: (row) =>
        Object.entries(row.labels ?? {}).map(([key, value]) => `${key}: ${value}`),
      filterFn: (row, id, value) => {
        return value.some((label: string) => (row.getValue(id) as string).includes(label));
      },
    },
    {
      id: "lastEvent",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="px-2 hover:bg-muted/50"
          >
            Last Event
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
      accessorFn: (row) => getLastEvent(row).date,
      cell: ({ row }) => {
        return <span className="px-2">{getLastEvent(row.original).relativeTimeString}</span>;
      },
    },
    {
      id: "createdAt",
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
      accessorFn: (row) => getCreatedAt(row).date,
      cell: ({ row }) => {
        return <span className="px-2">{getCreatedAt(row.original).relativeTimeString}</span>;
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        if (!writePermitted && !deletePermitted) return null;

        const sandbox = row.original;

        let terminalUrl: string | null = null;

        if (!sandbox.nodeVersion) {
          terminalUrl = `https://22222-${sandbox.id}.${sandbox.executorDomain}`;
        } else {
          terminalUrl =
            env.NEXT_PUBLIC_PROXY_TEMPLATE_URL?.replace("{{PORT}}", "22222").replace(
              "{{sandboxId}}",
              sandbox.id
            ) || null;
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
              {writePermitted && (
                <>
                  {sandbox.state === SandboxState.STARTED && (
                    <>
                      <DropdownMenuItem
                        onClick={() => handleStop(sandbox.id)}
                        className="cursor-pointer"
                      >
                        <StopCircleIcon className="h-4 w-4" /> Stop
                      </DropdownMenuItem>

                      {terminalUrl && (
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <a href={terminalUrl} target="_blank" rel="noopener noreferrer">
                            <TerminalIcon className="h-4 w-4" /> Terminal
                          </a>
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  {(sandbox.state === SandboxState.STOPPED ||
                    sandbox.state === SandboxState.ARCHIVED) && (
                    <DropdownMenuItem
                      onClick={() => handleStart(sandbox.id)}
                      className="cursor-pointer"
                    >
                      <PlayIcon className="h-4 w-4" /> Start
                    </DropdownMenuItem>
                  )}
                  {sandbox.state === SandboxState.STOPPED && (
                    <DropdownMenuItem
                      onClick={() => handleArchive(sandbox.id)}
                      className="cursor-pointer"
                    >
                      <ArchiveIcon className="h-4 w-4" /> Archive
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {deletePermitted && (
                <>
                  {(sandbox.state === SandboxState.STOPPED ||
                    sandbox.state === SandboxState.STARTED) && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 dark:text-red-400"
                    onClick={() => handleDelete(sandbox.id)}
                  >
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return columns;
};
