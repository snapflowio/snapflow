/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Variant styles for the Checkbox component.
 * Controls size and visual style.
 *
 * @example
 * ```tsx
 * // Default checkbox
 * <Checkbox />
 *
 * // Small checkbox (for tables)
 * <Checkbox size="sm" />
 *
 * // Large checkbox
 * <Checkbox size="lg" />
 * ```
 */
const checkboxVariants = cva(
	[
		'peer flex shrink-0 cursor-pointer items-center justify-center rounded-[4px] border transition-colors',
		'border-(--border-1) bg-transparent',
		'focus-visible:outline-none',
		'data-disabled:cursor-not-allowed data-disabled:opacity-50',
		'data-[state=checked]:border-(--text-primary) data-[state=checked]:bg-(--text-primary)',
	].join(' '),
	{
		variants: {
			size: {
				sm: 'h-[14px] w-[14px]',
				md: 'h-4 w-4',
				lg: 'h-5 w-5',
			},
		},
		defaultVariants: {
			size: 'md',
		},
	}
);

/**
 * Variant styles for the Checkbox indicator icon.
 */
const checkboxIconVariants = cva('stroke-3', {
	variants: {
		size: {
			sm: 'h-[10px] w-[10px]',
			md: 'h-3.5 w-3.5',
			lg: 'h-4 w-4',
		},
	},
	defaultVariants: {
		size: 'md',
	},
});

export interface CheckboxProps
	extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
		VariantProps<typeof checkboxVariants> {}

/**
 * A checkbox component with size variants.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Checkbox checked={checked} onCheckedChange={setChecked} />
 *
 * // Small checkbox for tables
 * <Checkbox size="sm" checked={isSelected} onCheckedChange={handleSelect} />
 *
 * // With label
 * <div className="flex items-center gap-2">
 *   <Checkbox id="terms" />
 *   <Label htmlFor="terms">Accept terms</Label>
 * </div>
 * ```
 */
const Checkbox = React.memo(
	React.forwardRef<
		React.ElementRef<typeof CheckboxPrimitive.Root>,
		CheckboxProps
	>(({ className, size, ...props }, ref) => (
		<CheckboxPrimitive.Root
			ref={ref}
			className={cn(checkboxVariants({ size }), className)}
			{...props}
		>
			<CheckboxPrimitive.Indicator className="flex items-center justify-center text-surface-2">
				<Check className={cn(checkboxIconVariants({ size }))} />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	))
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox, checkboxVariants, checkboxIconVariants };
