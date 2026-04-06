/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const inputVariants = cva(
	'flex w-full rounded-[4px] border border-(--border-1) bg-(--surface-5) px-[8px] py-[6px] font-medium font-sans text-sm text-(--text-primary) transition-colors placeholder:text-(--text-muted) outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
	{
		variants: {
			variant: {
				default: '',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	}
);

export interface InputProps
	extends React.InputHTMLAttributes<HTMLInputElement>,
		VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, variant, type = 'text', ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(inputVariants({ variant }), className)}
				ref={ref}
				{...props}
			/>
		);
	}
);

Input.displayName = 'Input';

export { Input, inputVariants };
