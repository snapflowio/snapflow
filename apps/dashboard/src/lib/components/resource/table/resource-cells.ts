/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { renderComponent } from '@tanstack/svelte-table';
import CellContent from './cell-content.svelte';
import type { ResourceCell } from './resource-table.ts';

export function resourceCell<TData>(cell: ResourceCell<TData>, data: TData) {
	return renderComponent(CellContent<TData>, { cell, data });
}

export function resourceTextCell(cell: ResourceCell) {
	return resourceCell(cell, undefined);
}
