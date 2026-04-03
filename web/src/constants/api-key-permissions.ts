/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CreateApiKeyPermissionsEnum } from '@snapflow/api-client';

export const CREATE_API_KEY_PERMISSIONS_GROUPS: {
	name: string;
	permissions: CreateApiKeyPermissionsEnum[];
}[] = [
	{
		name: 'Sandboxes',
		permissions: [
			CreateApiKeyPermissionsEnum.WRITE_SANDBOXES,
			CreateApiKeyPermissionsEnum.DELETE_SANDBOXES,
		],
	},
	{
		name: 'Images',
		permissions: [
			CreateApiKeyPermissionsEnum.WRITE_IMAGES,
			CreateApiKeyPermissionsEnum.DELETE_IMAGES,
		],
	},
	{
		name: 'Registries',
		permissions: [
			CreateApiKeyPermissionsEnum.WRITE_REGISTRIES,
			CreateApiKeyPermissionsEnum.DELETE_REGISTRIES,
		],
	},
	{
		name: 'Buckets',
		permissions: [
			CreateApiKeyPermissionsEnum.READ_BUCKETS,
			CreateApiKeyPermissionsEnum.WRITE_BUCKETS,
			CreateApiKeyPermissionsEnum.DELETE_BUCKETS,
		],
	},
];
