import { useCallback, useEffect, useState } from "react";
import {
  OrganizationUserRoleEnum,
  Sandbox,
  SandboxDesiredState,
  SandboxState,
} from "@snapflow/api-client";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { handleApiError } from "@/lib/errors";
import { OrganizationSuspendedError } from "@/api/errors";
import { Path } from "@/enums/paths";
import { useApi } from "@/hooks/use-api";
import { useRealtime } from "@/hooks/use-realtime";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";
import { SandboxTable } from "./components/sandbox-table";

export function Sandboxes() {
  const { sandboxApi } = useApi();
  const { realtimeSocket } = useRealtime();

  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [loadingSandboxes, setLoadingSandboxes] = useState<Record<string, boolean>>({});
  const [loadingTable, setLoadingTable] = useState(true);
  const [sandboxToDelete, setSandboxToDelete] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const navigate = useNavigate();

  const { selectedOrganization, authenticatedUserOrganizationMember } = useSelectedOrganization();

  const fetchSandboxes = useCallback(
    async (showTableLoadingState = true) => {
      if (!selectedOrganization) return;
      if (showTableLoadingState) setLoadingTable(true);

      try {
        const sandboxes = (await sandboxApi.listSandboxes(selectedOrganization.id)).data;
        setSandboxes(sandboxes);
      } catch (error) {
        handleApiError(error, "Failed to fetch sandboxes");
      } finally {
        setLoadingTable(false);
      }
    },
    [sandboxApi, selectedOrganization]
  );

  useEffect(() => {
    fetchSandboxes();
  }, [fetchSandboxes]);

  useEffect(() => {
    const handleSandboxCreatedEvent = (sandbox: Sandbox) => {
      if (!sandboxes.some((s) => s.id === sandbox.id)) setSandboxes((prev) => [sandbox, ...prev]);
    };

    const handleSandboxStateUpdatedEvent = (data: {
      sandbox: Sandbox;
      oldState: SandboxState;
      newState: SandboxState;
    }) => {
      if (data.newState === SandboxState.DESTROYED) {
        setSandboxes((prev) => prev.filter((s) => s.id !== data.sandbox.id));
      } else if (!sandboxes.some((s) => s.id === data.sandbox.id)) {
        setSandboxes((prev) => [data.sandbox, ...prev]);
      } else {
        setSandboxes((prev) => prev.map((s) => (s.id === data.sandbox.id ? data.sandbox : s)));
      }
    };

    const handleSandboxDesiredStateUpdatedEvent = (data: {
      sandbox: Sandbox;
      oldDesiredState: SandboxDesiredState;
      newDesiredState: SandboxDesiredState;
    }) => {
      if (
        data.newDesiredState === SandboxDesiredState.DESTROYED &&
        data.sandbox.state &&
        ([SandboxState.ERROR, SandboxState.BUILD_FAILED] as SandboxState[]).includes(
          data.sandbox.state
        )
      ) {
        setSandboxes((prev) => prev.filter((s) => s.id !== data.sandbox.id));
      }
    };

    realtimeSocket.on("sandbox.created", handleSandboxCreatedEvent);
    realtimeSocket.on("sandbox.state.updated", handleSandboxStateUpdatedEvent);
    realtimeSocket.on("sandbox.desired-state.updated", handleSandboxDesiredStateUpdatedEvent);

    return () => {
      realtimeSocket.off("sandbox.created", handleSandboxCreatedEvent);
      realtimeSocket.off("sandbox.state.updated", handleSandboxStateUpdatedEvent);
      realtimeSocket.off("sandbox.desired-state.updated", handleSandboxDesiredStateUpdatedEvent);
    };
  }, [realtimeSocket, sandboxes]);

  const handleStart = async (id: string) => {
    setLoadingSandboxes((prev) => ({ ...prev, [id]: true }));

    const sandboxToStart = sandboxes.find((s) => s.id === id);
    const previousState = sandboxToStart?.state;

    setSandboxes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, state: SandboxState.STARTING } : s))
    );

    try {
      await sandboxApi.startSandbox(id, selectedOrganization?.id);
      toast.success(`Starting sandbox with ID: ${id}`);
    } catch (error) {
      handleApiError(
        error,
        "Failed to start sandbox",
        error instanceof OrganizationSuspendedError &&
          import.meta.env.VITE_BILLING_API_URL &&
          authenticatedUserOrganizationMember?.role === OrganizationUserRoleEnum.OWNER ? (
          <Button variant="secondary" onClick={() => navigate(Path.BILLING)}>
            Go to billing
          </Button>
        ) : undefined
      );

      setSandboxes((prev) => prev.map((s) => (s.id === id ? { ...s, state: previousState } : s)));
    } finally {
      setLoadingSandboxes((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleStop = async (id: string) => {
    setLoadingSandboxes((prev) => ({ ...prev, [id]: true }));

    const sandboxToStop = sandboxes.find((s) => s.id === id);
    const previousState = sandboxToStop?.state;

    setSandboxes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, state: SandboxState.STOPPING } : s))
    );

    try {
      await sandboxApi.stopSandbox(id, selectedOrganization?.id);
      toast.success(`Stopping sandbox with ID: ${id}`);
    } catch (error) {
      handleApiError(error, "Failed to stop sandbox");
      setSandboxes((prev) => prev.map((s) => (s.id === id ? { ...s, state: previousState } : s)));
    } finally {
      setLoadingSandboxes((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    setLoadingSandboxes((prev) => ({ ...prev, [id]: true }));
    const sandboxToDelete = sandboxes.find((s) => s.id === id);
    const previousState = sandboxToDelete?.state;

    setSandboxes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, state: SandboxState.DESTROYING } : s))
    );

    try {
      await sandboxApi.deleteSandbox(id, true, selectedOrganization?.id);
      setSandboxToDelete(null);
      setShowDeleteDialog(false);
      toast.success(`Deleting sandbox with ID:  ${id}`);
    } catch (error) {
      handleApiError(error, "Failed to delete sandbox");
      // Revert the optimistic update
      setSandboxes((prev) => prev.map((s) => (s.id === id ? { ...s, state: previousState } : s)));
    } finally {
      setLoadingSandboxes((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleArchive = async (id: string) => {
    setLoadingSandboxes((prev) => ({ ...prev, [id]: true }));

    const sandboxToArchive = sandboxes.find((s) => s.id === id);
    const previousState = sandboxToArchive?.state;

    setSandboxes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, state: SandboxState.ARCHIVING } : s))
    );

    try {
      await sandboxApi.archiveSandbox(id, selectedOrganization?.id);
      toast.success(`Archiving sandbox with ID: ${id}`);
    } catch (error) {
      handleApiError(error, "Failed to archive sandbox");
      setSandboxes((prev) => prev.map((s) => (s.id === id ? { ...s, state: previousState } : s)));
    } finally {
      setLoadingSandboxes((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="px-2">
      <div className="mb-3">
        <h1 className="font-bold text-2xl">Sandboxes</h1>
      </div>
      <SandboxTable
        loadingSandboxes={loadingSandboxes}
        handleStart={handleStart}
        handleStop={handleStop}
        handleDelete={(id) => {
          setSandboxToDelete(id);
          setShowDeleteDialog(true);
        }}
        handleArchive={handleArchive}
        data={sandboxes}
        loading={loadingTable}
      />

      {sandboxToDelete && (
        <Dialog
          open={showDeleteDialog}
          onOpenChange={(isOpen) => {
            setShowDeleteDialog(isOpen);
            if (!isOpen) {
              setSandboxToDelete(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Sandbox Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this sandbox? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => handleDelete(sandboxToDelete)}
                disabled={loadingSandboxes[sandboxToDelete]}
              >
                {loadingSandboxes[sandboxToDelete] ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
