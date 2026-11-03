/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	getAuthenticatedUserQueryKey,
	getPublicConfigQueryKey,
} from '@snapflow/api-client/svelte-query';
import { matchQuery, type Query } from '@tanstack/svelte-query';
import { authQueryKeys } from './session.ts';

const [{ _id: PUBLIC_CONFIG_OPERATION_ID }] = getPublicConfigQueryKey();
const [{ _id: AUTHENTICATED_USER_OPERATION_ID }] =
	getAuthenticatedUserQueryKey();

function generatedOperationId(queryKey: readonly unknown[]): string | null {
	const [head] = queryKey;
	return typeof head === 'object' &&
		head !== null &&
		'_id' in head &&
		typeof head._id === 'string'
		? head._id
		: null;
}

export function isUserScopedQuery(query: Query): boolean {
	return (
		generatedOperationId(query.queryKey) !== PUBLIC_CONFIG_OPERATION_ID &&
		!matchQuery({ queryKey: authQueryKeys.session() }, query)
	);
}

export function isOrganizationScopedQuery(query: Query): boolean {
	return (
		isUserScopedQuery(query) &&
		generatedOperationId(query.queryKey) !== AUTHENTICATED_USER_OPERATION_ID
	);
}
