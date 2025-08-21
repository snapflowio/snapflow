"use client";

import { useState } from "react";
import {
  CreateOrganizationInvitationRoleEnum,
  OrganizationRole,
  OrganizationUser,
  OrganizationUserRoleEnum,
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
import { CreateOrganizationInvitationDialog } from "@/components/dialogs/create-organization-invitation-dialog";
import { RemoveOrganizationMemberDialog } from "@/components/dialogs/remove-organization-member-dialog";
import { UpdateAssignedOrganizationRolesDialog } from "@/components/dialogs/update-assigned-organization-roles-dialog";
import { UpdateOrganizationMemberRoleDialog } from "@/components/dialogs/update-organization-member-roles-dialog";
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
import { capitalize } from "@/lib/util";
import { DEFAULT_PAGE_SIZE } from "@/constants/pagination";

interface DataTableProps {
  data: OrganizationUser[];
  loadingData: boolean;
  availableOrganizationRoles: OrganizationRole[];
  loadingAvailableOrganizationRoles: boolean;
  onUpdateMemberRole: (userId: string, role: OrganizationUserRoleEnum) => Promise<boolean>;
  onUpdateAssignedOrganizationRoles: (userId: string, roleIds: string[]) => Promise<boolean>;
  onRemoveMember: (userId: string) => Promise<boolean>;
  loadingMemberAction: Record<string, boolean>;
  ownerMode: boolean;
  onCreateInvitation?: (
    email: string,
    role: CreateOrganizationInvitationRoleEnum,
    assignedRoleIds: string[]
  ) => Promise<boolean>;
}

export function OrganizationMemberTable({
  data,
  loadingData,
  availableOrganizationRoles,
  loadingAvailableOrganizationRoles,
  onUpdateMemberRole,
  onUpdateAssignedOrganizationRoles,
  onRemoveMember,
  loadingMemberAction,
  ownerMode,
  onCreateInvitation,
}: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [memberToUpdate, setMemberToUpdate] = useState<OrganizationUser | null>(null);
  const [isUpdateMemberRoleDialogOpen, setIsUpdateMemberRoleDialogOpen] = useState(false);
  const [isUpdateAssignedRolesDialogOpen, setIsUpdateAssignedRolesDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  const columns = getColumns({
    onUpdateMemberRole: (member) => {
      setMemberToUpdate(member);
      setIsUpdateMemberRoleDialogOpen(true);
    },
    onUpdateAssignedRoles: (member) => {
      setMemberToUpdate(member);
      setIsUpdateAssignedRolesDialogOpen(true);
    },
    onRemove: (userId: string) => {
      setMemberToRemove(userId);
      setIsRemoveDialogOpen(true);
    },
    ownerMode,
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

  const handleUpdateMemberRole = async (role: OrganizationUserRoleEnum) => {
    if (memberToUpdate) {
      const success = await onUpdateMemberRole(memberToUpdate.userId, role);
      if (success) {
        setMemberToUpdate(null);
        setIsUpdateMemberRoleDialogOpen(false);
      }
      return success;
    }
    return false;
  };

  const handleUpdateAssignedRoles = async (roleIds: string[]) => {
    if (memberToUpdate) {
      const success = await onUpdateAssignedOrganizationRoles(memberToUpdate.userId, roleIds);
      if (success) {
        setMemberToUpdate(null);
        setIsUpdateAssignedRolesDialogOpen(false);
      }
      return success;
    }
    return false;
  };

  const handleConfirmRemove = async () => {
    if (memberToRemove) {
      const success = await onRemoveMember(memberToRemove);
      if (success) {
        setMemberToRemove(null);
        setIsRemoveDialogOpen(false);
      }
      return success;
    }
    return false;
  };

  return (
    <>
      <Card className="flex h-full flex-col">
        <CardHeader className="flex flex-shrink-0 flex-row items-center justify-between">
          <div>
            <CardTitle>Members</CardTitle>
            <CardDescription>Manage organization members and their roles</CardDescription>
          </div>
          {ownerMode && onCreateInvitation && (
            <CreateOrganizationInvitationDialog
              availableRoles={availableOrganizationRoles}
              loadingAvailableRoles={loadingAvailableOrganizationRoles}
              onCreateInvitation={onCreateInvitation}
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
                {loadingData ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      Loading members...
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={`${loadingMemberAction[row.original.userId] ? "pointer-events-none opacity-50" : ""}`}
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
                          <h3 className="font-medium text-lg">No members</h3>
                          <p className="mt-2 text-muted-foreground text-sm">
                            No organization members found.
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
          <Pagination table={table} entityName="Members" />
        </CardFooter>
      </Card>

      {memberToUpdate && (
        <UpdateOrganizationMemberRoleDialog
          open={isUpdateMemberRoleDialogOpen}
          onOpenChange={(open) => {
            setIsUpdateMemberRoleDialogOpen(open);
            if (!open) {
              setMemberToUpdate(null);
            }
          }}
          initialRole={memberToUpdate.role}
          onUpdateMemberRole={handleUpdateMemberRole}
          loading={loadingMemberAction[memberToUpdate.userId]}
        />
      )}

      {memberToUpdate && (
        <UpdateAssignedOrganizationRolesDialog
          open={isUpdateAssignedRolesDialogOpen}
          onOpenChange={(open) => {
            setIsUpdateAssignedRolesDialogOpen(open);
            if (!open) {
              setMemberToUpdate(null);
            }
          }}
          initialData={memberToUpdate.assignedRoles}
          availableRoles={availableOrganizationRoles}
          loadingAvailableRoles={loadingAvailableOrganizationRoles}
          onUpdateAssignedRoles={handleUpdateAssignedRoles}
          loading={loadingMemberAction[memberToUpdate.userId]}
        />
      )}

      {memberToRemove && (
        <RemoveOrganizationMemberDialog
          open={isRemoveDialogOpen}
          onOpenChange={(open) => {
            setIsRemoveDialogOpen(open);
            if (!open) {
              setMemberToRemove(null);
            }
          }}
          onRemoveMember={handleConfirmRemove}
          loading={loadingMemberAction[memberToRemove]}
        />
      )}
    </>
  );
}

const getColumns = ({
  onUpdateMemberRole,
  onUpdateAssignedRoles,
  onRemove,
  ownerMode,
}: {
  onUpdateMemberRole: (member: OrganizationUser) => void;
  onUpdateAssignedRoles: (member: OrganizationUser) => void;
  onRemove: (userId: string) => void;
  ownerMode: boolean;
}): ColumnDef<OrganizationUser>[] => {
  const columns: ColumnDef<OrganizationUser>[] = [
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
      accessorKey: "role",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="w-24 px-2 hover:bg-muted/50"
          >
            Role
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
        const role = capitalize(row.original.role);

        if (!ownerMode) {
          return <div className="px-2 text-sm">{role}</div>;
        }

        return (
          <Button
            variant="ghost"
            className="w-auto px-2"
            onClick={() => onUpdateMemberRole(row.original)}
          >
            {role}
          </Button>
        );
      },
    },
  ];

  if (ownerMode) {
    const extraColumns: ColumnDef<OrganizationUser>[] = [
      {
        accessorKey: "assignedRoles",
        header: () => {
          return (
            <Button variant="ghost" className="w-32 px-2 cursor-default">
              Assignments
            </Button>
          );
        },
        cell: ({ row }) => {
          if (row.original.role === OrganizationUserRoleEnum.OWNER) {
            return <div className="px-2 text-muted-foreground text-sm">Full Access</div>;
          }

          const roleCount = row.original.assignedRoles?.length || 0;
          const roleText = roleCount === 1 ? "1 role" : `${roleCount} roles`;

          return (
            <Button
              variant="ghost"
              className="w-auto px-2"
              onClick={() => onUpdateAssignedRoles(row.original)}
            >
              {roleText}
            </Button>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
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
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => onUpdateMemberRole(row.original)}
                  >
                    Change Role
                  </DropdownMenuItem>
                  {row.original.role !== OrganizationUserRoleEnum.OWNER && (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => onUpdateAssignedRoles(row.original)}
                    >
                      Manage Assignments
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 dark:text-red-400"
                    onClick={() => onRemove(row.original.userId)}
                  >
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ];
    columns.push(...extraColumns);
  }

  return columns;
};
