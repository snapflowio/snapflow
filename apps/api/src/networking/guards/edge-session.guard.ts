/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { EDGE_SESSION_HEADER } from '../constants/edge.constants';
import type { EdgeSession } from '../entities/edge-session.entity';
import { EdgeSessionService } from '../services/edge/edge-session.service';

export const EDGE_SESSION_REQUEST_PROPERTY = 'edgeSession' as const;

export type EdgeSessionRequest = Request & {
	[EDGE_SESSION_REQUEST_PROPERTY]?: EdgeSession;
};

@Injectable()
export class EdgeSessionGuard {
	constructor(private readonly edgeSessionService: EdgeSessionService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<EdgeSessionRequest>();
		const sessionId = this.readHeader(request, EDGE_SESSION_HEADER.id);
		const token = this.readHeader(request, EDGE_SESSION_HEADER.token);
		request[EDGE_SESSION_REQUEST_PROPERTY] =
			await this.edgeSessionService.authenticate(sessionId, token);
		return true;
	}

	private readHeader(request: Request, name: string): string {
		const value = request.headers[name];
		if (typeof value !== 'string' || value.length === 0) {
			throw new UnauthorizedException(
				`Required Edge session header ${name} is missing`
			);
		}
		return value;
	}
}
