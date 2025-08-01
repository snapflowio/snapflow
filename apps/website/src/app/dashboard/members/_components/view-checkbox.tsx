import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function ViewerCheckbox() {
  return (
    <div className="flex items-center space-x-4">
      <Checkbox id="role-viewer" checked={true} disabled={true} />
      <div className="space-y-1">
        <Label htmlFor="role-viewer" className="font-normal">
          Viewer
        </Label>
        <p className="text-gray-500 text-sm">
          Grants read access to sandboxes, snapshots, and registries in the organization
        </p>
      </div>
    </div>
  );
}
