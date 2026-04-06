/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as SliderPrimitive from '@radix-ui/react-slider';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps
	extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {}

/**
 * EMCN Slider component built on Radix UI Slider primitive.
 * Styled to match the Switch component with thin track design.
 *
 * @example
 * ```tsx
 * <Slider value={[50]} onValueChange={setValue} min={0} max={100} step={10} />
 * ```
 */
const Slider = React.forwardRef<
	React.ElementRef<typeof SliderPrimitive.Root>,
	SliderProps
>(({ className, disabled, ...props }, ref) => (
	<SliderPrimitive.Root
		ref={ref}
		disabled={disabled}
		className={cn(
			'relative flex w-full touch-none select-none items-center',
			'data-disabled:cursor-not-allowed data-disabled:opacity-50',
			className
		)}
		{...props}
	>
		<SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-[20px] bg-border-1 transition-colors">
			<SliderPrimitive.Range className="absolute h-full bg-text-primary" />
		</SliderPrimitive.Track>
		<SliderPrimitive.Thumb className="block h-3.5 w-3.5 cursor-pointer rounded-full bg-text-primary shadow-sm transition-colors focus-visible:outline-none" />
	</SliderPrimitive.Root>
));

Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
