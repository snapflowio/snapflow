/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const LIVE_ORGANIZATION_RESOURCE = {
	SANDBOXES: 'sandboxes',
	SNAPSHOTS: 'snapshots',
	VOLUMES: 'volumes',
	MACHINES: 'machines',
	REGISTRIES: 'registries',
	SECRETS: 'secrets',
	EXPOSURES: 'exposures',
} as const;

export type LiveOrganizationResource =
	(typeof LIVE_ORGANIZATION_RESOURCE)[keyof typeof LIVE_ORGANIZATION_RESOURCE];

export const ACCOUNT_HAS_LIVE_RESOURCES_CODE = 'ACCOUNT_HAS_LIVE_RESOURCES';
export const ACCOUNT_OWNS_SHARED_ORGANIZATIONS_CODE =
	'ACCOUNT_OWNS_SHARED_ORGANIZATIONS';
export const ORGANIZATION_HAS_LIVE_RESOURCES_CODE =
	'ORGANIZATION_HAS_LIVE_RESOURCES';
