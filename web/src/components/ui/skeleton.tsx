/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { cn } from '@/lib/utils';

/**
 * Placeholder loading skeleton with a subtle pulse animation.
 * @param props - Standard div attributes including className for sizing.
 */
function Skeleton({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn('animate-pulse rounded-md bg-surface-active', className)}
			{...props}
		/>
	);
}

export { Skeleton };
