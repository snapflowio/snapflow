/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/core';
import { CreateRequestContext } from '@mikro-orm/decorators/legacy';

export function IsolatedEntityManagerContext(): MethodDecorator {
	return CreateRequestContext(entityManagerOf);
}

function entityManagerOf(owner: unknown): EntityManager {
	if (
		typeof owner === 'object' &&
		owner !== null &&
		'entityManager' in owner &&
		owner.entityManager instanceof EntityManager
	) {
		return owner.entityManager;
	}
	throw new TypeError(
		'IsolatedEntityManagerContext requires an injected entityManager property'
	);
}
