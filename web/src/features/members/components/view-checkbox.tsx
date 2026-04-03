/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Checkbox, Label } from "@/components/ui";

export function ViewerCheckbox() {
  return (
    <div className="flex items-start space-x-3">
      <Checkbox id="role-viewer" checked disabled className="mt-0.5" />
      <div className="space-y-0.5">
        <Label htmlFor="role-viewer" className="font-medium text-sm">
          Viewer
        </Label>
        <p className="text-text-muted text-xs">
          Grants read access to sandboxes, images, and registries in the organization
        </p>
      </div>
    </div>
  );
}
