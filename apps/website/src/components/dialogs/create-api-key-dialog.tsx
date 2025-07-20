import { useCallback, useMemo, useState } from "react";
import { ApiKeyResponse, CreateApiKeyPermissionsEnum } from "@snapflow/api-client";
import { Check, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMaskedApiKey } from "@/lib/util";
import { CREATE_API_KEY_PERMISSIONS_GROUPS } from "@/constants/api-key-permissions";
import { CreateApiKeyPermissionGroup } from "@/constants/api-key-permissions-group";

interface CreateApiKeyDialogProps {
  availablePermissions: CreateApiKeyPermissionsEnum[];
  onCreateApiKey: (
    name: string,
    permissions: CreateApiKeyPermissionsEnum[],
    expiresAt: Date | null
  ) => Promise<ApiKeyResponse | null>;
}

export function CreateApiKeyDialog({
  availablePermissions,
  onCreateApiKey,
}: CreateApiKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
  const [checkedPermissions, setCheckedPermissions] =
    useState<CreateApiKeyPermissionsEnum[]>(availablePermissions);
  const [loading, setLoading] = useState(false);

  const [createdKey, setCreatedKey] = useState<ApiKeyResponse | null>(null);
  const [isCreatedKeyRevealed, setIsCreatedKeyRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const availableGroups = useMemo(() => {
    return CREATE_API_KEY_PERMISSIONS_GROUPS.map((group) => ({
      ...group,
      permissions: group.permissions.filter((p) => availablePermissions.includes(p)),
    })).filter((group) => group.permissions.length > 0);
  }, [availablePermissions]);

  const isGroupChecked = useCallback(
    (group: CreateApiKeyPermissionGroup) =>
      group.permissions.every((permission) => checkedPermissions.includes(permission)),
    [checkedPermissions]
  );

  const handleGroupToggle = useCallback((group: CreateApiKeyPermissionGroup) => {
    setCheckedPermissions((current) => {
      if (group.permissions.every((permission) => current.includes(permission))) {
        return current.filter((p) => !group.permissions.includes(p));
      }
      const newPermissions = [...current];
      group.permissions.forEach((key) => {
        if (!newPermissions.includes(key)) newPermissions.push(key);
      });
      return newPermissions;
    });
  }, []);

  const handlePermissionToggle = useCallback((permission: CreateApiKeyPermissionsEnum) => {
    setCheckedPermissions((current) =>
      current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission]
    );
  }, []);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  }, []);

  const handleCreateApiKey = useCallback(async () => {
    setLoading(true);
    try {
      const key = await onCreateApiKey(name, checkedPermissions, expiresAt ?? null);
      if (key) {
        setCreatedKey(key);
        setName("");
        setExpiresAt(undefined);
        setCheckedPermissions(availablePermissions);
      }
    } finally {
      setLoading(false);
    }
  }, [onCreateApiKey, name, checkedPermissions, expiresAt, availablePermissions]);

  const handleDialogOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        setName("");
        setExpiresAt(undefined);
        setCheckedPermissions(availablePermissions);
        setCreatedKey(null);
        setCopied(null);
        setIsCreatedKeyRevealed(false);
      }
    },
    [availablePermissions]
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" size="icon" className="w-auto px-4" title="Create Key">
          <Plus className="h-4 w-4" />
          Create Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New API Key</DialogTitle>
          <DialogDescription>
            Choose which actions this API key will be authorized to perform.
          </DialogDescription>
        </DialogHeader>
        {createdKey ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="api-key">API Key</Label>
              <div className="flex items-center justify-between rounded-md bg-muted p-3">
                <span
                  className="cursor-text select-all overflow-x-auto pr-2"
                  onMouseEnter={() => setIsCreatedKeyRevealed(true)}
                  onMouseLeave={() => setIsCreatedKeyRevealed(false)}
                >
                  {isCreatedKeyRevealed ? createdKey.value : getMaskedApiKey(createdKey.value)}
                </span>
                {(copied === "API Key" && <Check className="h-4 w-4" />) || (
                  <Copy
                    className="h-4 w-4 cursor-pointer"
                    onClick={() => copyToClipboard(createdKey.value, "API Key")}
                  />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="api-url">API URL</Label>
              <div className="flex items-center justify-between rounded-md bg-muted p-3">
                {import.meta.env.VITE_API_URL}
                {(copied === "API URL" && <Check className="h-4 w-4" />) || (
                  <Copy
                    className="h-4 w-4 cursor-pointer"
                    onClick={() => copyToClipboard(import.meta.env.VITE_API_URL, "API URL")}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <form
            id="create-api-key-form"
            className="space-y-6 overflow-y-auto px-1 pb-1"
            onSubmit={async (e) => {
              e.preventDefault();
              await handleCreateApiKey();
            }}
          >
            <div className="space-y-3">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="expires-at">Expires</Label>
              <DatePicker
                value={expiresAt}
                onChange={setExpiresAt}
                disabledBefore={new Date()}
                id="expires-at"
              />
            </div>
            {availableGroups.length > 0 && (
              <div className="space-y-3">
                <Label htmlFor="permissions">Permissions</Label>
                <div className="space-y-6">
                  {availableGroups.map((group) => {
                    const groupIsChecked = isGroupChecked(group);

                    return (
                      <div key={group.name} className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`group-${group.name}`}
                            checked={groupIsChecked}
                            onCheckedChange={() => handleGroupToggle(group)}
                          />
                          <Label htmlFor={`group-${group.name}`} className="font-normal">
                            {group.name}
                          </Label>
                        </div>
                        <div className="ml-6 space-y-2">
                          {group.permissions.map((permission) => (
                            <div key={permission} className="flex items-center space-x-2">
                              <Checkbox
                                id={permission}
                                checked={checkedPermissions.includes(permission)}
                                onCheckedChange={() => handlePermissionToggle(permission)}
                                disabled={groupIsChecked}
                                className={`${groupIsChecked ? "pointer-events-none" : ""}`}
                              />
                              <Label
                                htmlFor={permission}
                                className={`font-normal${groupIsChecked ? " pointer-events-none opacity-70" : ""}`}
                              >
                                {permission}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </form>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">Close</Button>
          </DialogClose>
          {loading ? (
            <Button type="button" variant="default" disabled>
              Creating...
            </Button>
          ) : (
            !createdKey && (
              <Button
                type="submit"
                form="create-api-key-form"
                variant="default"
                disabled={!name.trim() || !checkedPermissions.length}
              >
                Create
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
