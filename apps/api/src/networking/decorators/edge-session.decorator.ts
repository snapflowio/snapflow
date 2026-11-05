/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	createParamDecorator,
	type ExecutionContext,
	InternalServerErrorException,
} from '@nestjs/common';
import type { EdgeSession } from '../entities/edge-session.entity';
import {
	EDGE_SESSION_REQUEST_PROPERTY,
	type EdgeSessionRequest,
} from '../guards/edge-session.guard';

export const ActiveEdgeSession = createParamDecorator(
	(_data: unknown, context: ExecutionContext): EdgeSession => {
		const request = context.switchToHttp().getRequest<EdgeSessionRequest>();
		const session = request[EDGE_SESSION_REQUEST_PROPERTY];
		if (!session) {
			throw new InternalServerErrorException(
				'Edge session guard did not attach a session'
			);
		}
		return session;
	}
);
