/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { renderComponent } from '@tanstack/svelte-table';
import type { Snippet } from 'svelte';
import CellContent from './cell-content.svelte';

export interface ResourceLabelCell {
	icon?: Snippet;
	label?: string | null;
	sublabel?: string;
}

export function renderResourceLabel(cell: ResourceLabelCell) {
	return renderComponent(CellContent, { cell, data: undefined });
}
