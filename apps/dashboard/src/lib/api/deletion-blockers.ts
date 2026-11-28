/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	getAccountDeletionBlockersOptions,
	getActiveOrganizationDeletionBlockersOptions,
} from '@snapflow/api-client/svelte-query';

export function accountDeletionBlockersQueryOptions() {
	return { ...getAccountDeletionBlockersOptions(), staleTime: 0 };
}

export function organizationDeletionBlockersQueryOptions() {
	return { ...getActiveOrganizationDeletionBlockersOptions(), staleTime: 0 };
}
