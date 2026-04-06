/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { memo } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface HeaderAction {
	label: string;
	icon?: LucideIcon;
	onClick: () => void;
	disabled?: boolean;
}

export interface CreateAction {
	label: string;
	onClick: () => void;
	disabled?: boolean;
}

interface ResourceHeaderProps {
	icon?: LucideIcon;
	title?: string;
	actions?: HeaderAction[];
	create?: CreateAction;
}

export const ResourceHeader = memo(function ResourceHeader({
	icon: Icon,
	title,
	actions,
	create,
}: ResourceHeaderProps) {
	return (
		<div className="shrink-0 border-border border-b px-6 py-2.5">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					{Icon && <Icon className="h-3.5 w-3.5 text-text-icon" />}
					{title && (
						<h1 className="font-medium text-[14px] text-text-body">{title}</h1>
					)}
				</div>
				<div className="flex items-center gap-1.5">
					{actions?.map((action) => {
						const ActionIcon = action.icon;
						return (
							<Button
								key={action.label || 'action'}
								variant="subtle"
								size="sm"
								onClick={action.onClick}
								disabled={action.disabled}
							>
								{ActionIcon && (
									<ActionIcon
										className={cn(
											'h-3.5 w-3.5 text-text-icon',
											action.label && 'mr-1.5'
										)}
									/>
								)}
								{action.label}
							</Button>
						);
					})}
					{create && (
						<Button
							variant="subtle"
							size="sm"
							onClick={create.onClick}
							disabled={create.disabled}
						>
							<Plus className="mr-1.5 h-3.5 w-3.5 text-text-icon" />
							{create.label}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
});
