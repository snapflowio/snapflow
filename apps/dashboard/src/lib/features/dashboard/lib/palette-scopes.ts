/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import ImageIcon from '@lucide/svelte/icons/image';
import ServerIcon from '@lucide/svelte/icons/server';
import type {
	Machine,
	SandboxListItem,
	SnapshotDto,
} from '@snapflow/api-client';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import TerminalWindow from '#lib/components/icons/terminal-window.svelte';
import type { OrganizationPermission } from '#lib/features/organizations/lib/organization-permission.ts';
import { SNAPSHOT_PANEL_PARAM } from '#lib/features/snapshots/lib/snapshots-list.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

export const PALETTE_SEARCH_LIMIT = 5;

export const PaletteScopeId = {
	Sandboxes: 'sandboxes',
	Machines: 'machines',
	Snapshots: 'snapshots',
} as const;

export type PaletteScopeId =
	(typeof PaletteScopeId)[keyof typeof PaletteScopeId];

export interface PaletteScope {
	id: PaletteScopeId;
	label: string;
	icon: IconComponent;
	placeholder: string;
	permission: OrganizationPermission;
}

export interface PaletteScopeItem {
	id: string;
	label: string;
	href: string;
	scope: PaletteScopeId;
}

export const PALETTE_SCOPES: Readonly<Record<PaletteScopeId, PaletteScope>> = {
	[PaletteScopeId.Sandboxes]: {
		id: PaletteScopeId.Sandboxes,
		label: 'Sandboxes',
		icon: TerminalWindow,
		placeholder: 'Search sandboxes by name',
		permission: { sandboxes: ['read'] },
	},
	[PaletteScopeId.Machines]: {
		id: PaletteScopeId.Machines,
		label: 'Machines',
		icon: ServerIcon,
		placeholder: 'Search machines by name',
		permission: { machines: ['read'] },
	},
	[PaletteScopeId.Snapshots]: {
		id: PaletteScopeId.Snapshots,
		label: 'Snapshots',
		icon: ImageIcon,
		placeholder: 'Search snapshots by name',
		permission: { snapshots: ['read'] },
	},
};

export function sandboxScopeItem(sandbox: SandboxListItem): PaletteScopeItem {
	return {
		id: `sandbox-${sandbox.id}`,
		label: sandbox.name,
		href: resolve('/(app)/(dashboard)/sandboxes/[sandboxId]', {
			sandboxId: sandbox.id,
		}),
		scope: PaletteScopeId.Sandboxes,
	};
}

export function machineScopeItem(machine: Machine): PaletteScopeItem {
	return {
		id: `machine-${machine.id}`,
		label: machine.name,
		href: resolve('/(app)/(dashboard)/machines/[machineId]', {
			machineId: machine.id,
		}),
		scope: PaletteScopeId.Machines,
	};
}

export function snapshotScopeItem(snapshot: SnapshotDto): PaletteScopeItem {
	const search = new URLSearchParams({ [SNAPSHOT_PANEL_PARAM]: snapshot.id });
	return {
		id: `snapshot-${snapshot.id}`,
		label: snapshot.name,
		href: `${resolvePath(Path.SNAPSHOTS)}?${search}`,
		scope: PaletteScopeId.Snapshots,
	};
}

export function namedMatching<TItem extends { name: string }>(
	items: readonly TItem[],
	search: string
): TItem[] {
	const query = search.trim().toLowerCase();
	return items
		.filter((item) => item.name.toLowerCase().includes(query))
		.slice(0, PALETTE_SEARCH_LIMIT);
}
