"use client";

import { useState } from "react";
import {
  OrganizationInvitation,
  OrganizationRole,
  UpdateOrganizationInvitationRoleEnum,
} from "@snapflow/api-client";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon, MoreHorizontal } from "lucide-react";
import { CancelOrganizationInvitationDialog } from "@/components/dialogs/cancel-organization-invitation-dialog";
import { UpdateOrganizationInvitationDialog } from "@/components/dialogs/update-organization-invitation-dialog";
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
import { DEFAULT_PAGE_SIZE } from "@/constants/pagination";

interface DataTableProps {
  data: OrganizationInvitation[];
  loadingData: boolean;
  availableRoles: OrganizationRole[];
  loadingAvailableRoles: boolean;
  onCancelInvitation: (invitationId: string) => Promise<boolean>;
  onUpdateInvitation: (
    invitationId: string,
    role: UpdateOrganizationInvitationRoleEnum,
    assignedRoleIds: string[]
  ) => Promise<boolean>;
  loadingInvitationAction: Record<string, boolean>;
}

export function OrganizationInvitationTable({
  data,
  loadingData,
  availableRoles,
  loadingAvailableRoles,
  onCancelInvitation,
  onUpdateInvitation,
  loadingInvitationAction,
}: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [invitationToCancel, setInvitationToCancel] = useState<string | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [invitationToUpdate, setInvitationToUpdate] = useState<OrganizationInvitation | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

  const handleCancel = (invitationId: string) => {
    setInvitationToCancel(invitationId);
    setIsCancelDialogOpen(true);
  };

  const handleUpdate = (invitation: OrganizationInvitation) => {
    setInvitationToUpdate(invitation);
    setIsUpdateDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (invitationToCancel) {
      const success = await onCancelInvitation(invitationToCancel);
      if (success) {
        setInvitationToCancel(null);
        setIsCancelDialogOpen(false);
      }
      return success;
    }
    return false;
  };

  const handleConfirmUpdate = async (
    role: UpdateOrganizationInvitationRoleEnum,
    assignedRoleIds: string[]
  ) => {
    if (invitationToUpdate) {
      const success = await onUpdateInvitation(invitationToUpdate.id, role, assignedRoleIds);
      if (success) {
        setInvitationToUpdate(null);
        setIsUpdateDialogOpen(false);
      }
      return success;
    }
    return false;
  };

  const columns = getColumns({
    onCancel: handleCancel,
    onUpdate: handleUpdate,
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: DEFAULT_PAGE_SIZE,
      },
    },
  });

  return (
    <>
      <Card className="flex h-full flex-col">
        <CardHeader className="flex flex-shrink-0 flex-row items-center justify-between">
          <div>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>Manage pending organization invitations</CardDescription>
          </div>
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
                {loadingData ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      Loading invitations...
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={`${loadingInvitationAction[row.original.id] ? "pointer-events-none opacity-50" : ""}`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="relative h-[400px] p-0">
                      <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                        <div className="text-center">
                          <h3 className="font-medium text-lg">No invitations</h3>
                          <p className="mt-2 text-muted-foreground text-sm">
                            No pending invitations found.
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
          <Pagination table={table} entityName="Invitations" />
        </CardFooter>
      </Card>

      {invitationToUpdate && (
        <UpdateOrganizationInvitationDialog
          open={isUpdateDialogOpen}
          onOpenChange={(open) => {
            setIsUpdateDialogOpen(open);
            if (!open) {
              setInvitationToUpdate(null);
            }
          }}
          invitation={invitationToUpdate}
          availableRoles={availableRoles}
          loadingAvailableRoles={loadingAvailableRoles}
          onUpdateInvitation={handleConfirmUpdate}
        />
      )}

      {invitationToCancel && (
        <CancelOrganizationInvitationDialog
          open={isCancelDialogOpen}
          onOpenChange={(open) => {
            setIsCancelDialogOpen(open);
            if (!open) {
              setInvitationToCancel(null);
            }
          }}
          onCancelInvitation={handleConfirmCancel}
          loading={loadingInvitationAction[invitationToCancel]}
        />
      )}
    </>
  );
}

const getColumns = ({
  onCancel,
  onUpdate,
}: {
  onCancel: (invitationId: string) => void;
  onUpdate: (invitation: OrganizationInvitation) => void;
}): ColumnDef<OrganizationInvitation>[] => {
  const columns: ColumnDef<OrganizationInvitation>[] = [
    {
      accessorKey: "email",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="px-2 hover:bg-muted/50"
          >
            Email
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
      cell: ({ row }) => <div className="px-2 font-medium">{row.original.email}</div>,
    },
    {
      accessorKey: "invitedBy",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="px-2 hover:bg-muted/50"
          >
            Invited by
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
      cell: ({ row }) => <span className="px-2">{row.original.invitedBy}</span>,
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
        return (
          <span className="px-2">{new Date(row.original.expiresAt).toLocaleDateString()}</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="px-2 hover:bg-muted/50"
          >
            Status
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
        const isExpired = new Date(row.original.expiresAt) < new Date();
        return (
          <span className="px-2">
            {isExpired ? (
              <span className="text-red-600 dark:text-red-400">Expired</span>
            ) : (
              "Pending"
            )}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const isExpired = new Date(row.original.expiresAt) < new Date();
        if (isExpired) {
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
                <DropdownMenuItem className="cursor-pointer" onClick={() => onUpdate(row.original)}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 dark:text-red-400"
                  onClick={() => onCancel(row.original.id)}
                >
                  Cancel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return columns;
};
