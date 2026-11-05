/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { HumanPrincipal } from '../../common/types/platform-principal.types';

export interface IdempotentRequestContext {
	key: string;
	organizationId: string;
	principal: Pick<HumanPrincipal, 'type' | 'id'>;
	method: string;
	routeTemplate: string;
	fingerprintInput: unknown;
}

export interface IdempotentMutationResponse<T> {
	body: T;
	status: number;
	headers?: Readonly<Record<string, string>>;
	resource?: {
		type: string;
		id: string;
	};
	sensitive?: boolean;
}

export interface IdempotentExecutionResult<T>
	extends IdempotentMutationResponse<T> {
	replayed: boolean;
}

export type IdempotentMutation<T> = (
	manager: EntityManager
) => Promise<IdempotentMutationResponse<T>>;
