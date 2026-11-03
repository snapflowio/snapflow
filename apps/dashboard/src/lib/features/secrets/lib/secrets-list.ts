/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SecretDto } from '@snapflow/api-client';
import * as z from 'zod';
import {
	type ResourceListSortAccessors,
	type ResourceListSortOption,
	sortColumnSchema,
	sortDirectionSchema,
} from '#lib/components/resource/resource-list.ts';

const SORT_COLUMNS = ['name', 'version', 'updated', 'created'] as const;
type SecretSortColumn = (typeof SORT_COLUMNS)[number];

export const SECRET_SORT_OPTIONS: readonly ResourceListSortOption<SecretSortColumn>[] =
	[
		{ id: 'name', label: 'Name' },
		{ id: 'version', label: 'Version' },
		{ id: 'updated', label: 'Updated' },
		{ id: 'created', label: 'Created' },
	];

export const SECRET_SORT_ACCESSORS: ResourceListSortAccessors<
	SecretDto,
	SecretSortColumn
> = {
	name: (secret) => secret.name,
	version: (secret) => secret.currentVersion,
	updated: (secret) => secret.updatedAt,
	created: (secret) => secret.createdAt,
};

export const secretsSearchSchema = z.object({
	search: z.string().catch(''),
	sort: sortColumnSchema(SORT_COLUMNS),
	dir: sortDirectionSchema,
});

export function matchesSecret(secret: SecretDto, search: string): boolean {
	return (
		!search ||
		secret.name.toLowerCase().includes(search) ||
		(secret.description?.toLowerCase().includes(search) ?? false)
	);
}
