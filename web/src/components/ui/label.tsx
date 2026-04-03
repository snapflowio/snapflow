/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {}

/**
 * EMCN Label component built on Radix UI Label primitive.
 *
 * @remarks
 * Provides consistent typography and styling for form labels.
 * Automatically handles disabled states through peer-disabled CSS.
 *
 * @param className - Additional CSS classes to apply
 * @param props - Additional props passed to the Radix Label primitive
 * @returns The styled label element
 *
 * @example
 * ```tsx
 * <Label htmlFor="email">Email Address</Label>
 * ```
 */
function Label({ className, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "inline-flex items-center font-medium text-(--text-primary) text-[13px] leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
