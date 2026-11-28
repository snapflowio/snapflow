/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { IconComponent } from '#lib/components/icons/icon-component.ts';

export interface ResourceRowAction {
	destructive?: boolean;
	disabled?: boolean;
	disabledReason?: string;
	icon?: IconComponent;
	label: string;
	onSelect: () => void;
	separated?: boolean;
	shortcut?: string | readonly string[];
	visible?: boolean;
}

export const MAX_QUICK_ROW_ACTIONS = 2;

export function visibleRowActions(
	actions: readonly ResourceRowAction[]
): ResourceRowAction[] {
	return actions.filter((action) => action.visible !== false);
}

export function hasVisibleRowActions(
	actions: readonly ResourceRowAction[]
): boolean {
	return actions.some((action) => action.visible !== false);
}

export function orderRowActions(
	actions: readonly ResourceRowAction[]
): ResourceRowAction[] {
	const visible = visibleRowActions(actions);
	return [
		...visible.filter((action) => !action.destructive),
		...visible.filter((action) => action.destructive),
	];
}
