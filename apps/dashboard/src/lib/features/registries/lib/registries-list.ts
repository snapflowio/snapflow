/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { DockerRegistry } from '@snapflow/api-client';
import * as z from 'zod';
import {
	type ResourceListSortAccessors,
	type ResourceListSortOption,
	sortColumnSchema,
	sortDirectionSchema,
} from '#lib/components/resource/resource-list.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { titleCase } from '#lib/utils/text.ts';

type RegistryType = DockerRegistry['registryType'];

export const ORGANIZATION_REGISTRY_TYPE: RegistryType = 'organization';

const REGISTRY_TYPES = [
	'organization',
	'internal',
	'transient',
	'backup',
] as const satisfies readonly RegistryType[];
const SORT_COLUMNS = ['name', 'url', 'username', 'type', 'created'] as const;
type RegistrySortColumn = (typeof SORT_COLUMNS)[number];

export const REGISTRY_SORT_OPTIONS: readonly ResourceListSortOption<RegistrySortColumn>[] =
	[
		{ id: 'name', label: 'Name' },
		{ id: 'url', label: 'URL' },
		{ id: 'username', label: 'Username' },
		{ id: 'type', label: 'Type' },
		{ id: 'created', label: 'Created' },
	];

export const REGISTRY_SORT_ACCESSORS: ResourceListSortAccessors<
	DockerRegistry,
	RegistrySortColumn
> = {
	name: (registry) => registry.name,
	url: (registry) => registry.url,
	username: (registry) => registry.username,
	type: (registry) => registry.registryType,
	created: (registry) => registry.createdAt,
};

export function registryTypeLabel(type: RegistryType): string {
	return titleCase(type);
}

export const REGISTRY_TYPE_OPTIONS = REGISTRY_TYPES.map((type) => ({
	label: registryTypeLabel(type),
	value: type,
}));

const registryTypeSchema = z.enum(REGISTRY_TYPES);

export function isRegistryType(value: string): value is RegistryType {
	return registryTypeSchema.safeParse(value).success;
}

export const registriesSearchSchema = z.object({
	search: z.string().catch(''),
	type: searchParamArray(registryTypeSchema).catch([]),
	sort: sortColumnSchema(SORT_COLUMNS),
	dir: sortDirectionSchema,
});

export function matchesRegistry(
	registry: DockerRegistry,
	search: string,
	types: readonly string[]
): boolean {
	return (
		(types.length === 0 || types.includes(registry.registryType)) &&
		(!search ||
			registry.name.toLowerCase().includes(search) ||
			registry.url.toLowerCase().includes(search) ||
			registry.username.toLowerCase().includes(search) ||
			(registry.project?.toLowerCase().includes(search) ?? false))
	);
}
