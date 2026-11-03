/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CustomHeaders } from '../../../common/constants/header.constants';
import {
	MUTATION_POLICY,
	mutationPolicyFor,
} from '../handlers/mutation-policy.registry';
import { parseIdempotencyKey } from '../utils/idempotency-key.util';

@Injectable()
export class IdempotencyKeyGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		if (context.getType() !== 'http') return true;
		const policy = mutationPolicyFor(
			context.getClass().name,
			context.getHandler().name
		);
		if (policy !== MUTATION_POLICY.REQUIRES_IDEMPOTENCY) return true;
		const request = context.switchToHttp().getRequest<Request>();
		parseIdempotencyKey(request.get(CustomHeaders.IDEMPOTENCY_KEY.name));
		return true;
	}
}
