/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { OrganizationPermission } from '#lib/features/organizations/lib/organization-permission.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';

const CREATE_SEARCH = '?create=1';

export const CreateCommandId = {
	Sandbox: 'create-sandbox',
	Machine: 'add-machine',
	ApiKey: 'create-api-key',
	WebhookEndpoint: 'create-webhook-endpoint',
} as const;

export type CreateCommandId =
	(typeof CreateCommandId)[keyof typeof CreateCommandId];

export interface CreateCommand {
	id: CreateCommandId;
	label: string;
	path: Path;
	search?: string;
	permission: OrganizationPermission;
}

export const CREATE_COMMANDS: Readonly<Record<CreateCommandId, CreateCommand>> =
	{
		[CreateCommandId.Sandbox]: {
			id: CreateCommandId.Sandbox,
			label: 'New sandbox',
			path: Path.SANDBOXES,
			search: CREATE_SEARCH,
			permission: { sandboxes: ['write'] },
		},
		[CreateCommandId.Machine]: {
			id: CreateCommandId.Machine,
			label: 'Add machine',
			path: Path.MACHINES_ADD,
			permission: { machines: ['write'] },
		},
		[CreateCommandId.ApiKey]: {
			id: CreateCommandId.ApiKey,
			label: 'Create API key',
			path: Path.SETTINGS_API_KEYS,
			search: CREATE_SEARCH,
			permission: { apiKey: ['create'] },
		},
		[CreateCommandId.WebhookEndpoint]: {
			id: CreateCommandId.WebhookEndpoint,
			label: 'Create webhook endpoint',
			path: Path.SETTINGS_WEBHOOKS,
			search: CREATE_SEARCH,
			permission: { webhooks: ['write'] },
		},
	};

export function createCommandHref(command: CreateCommand): string {
	return `${resolvePath(command.path)}${command.search ?? ''}`;
}
