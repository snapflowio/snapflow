/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { NotFoundError } from '@mikro-orm/core';
import {
	CanActivate,
	ExecutionContext,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
	isOrganizationAuthContext,
	type OrganizationAuthContext,
} from '../types/organization-auth-context.types';
import { getAuthContext } from '../utils/auth-context.util';

export type ResourceRequest = Request<Record<string, string>>;

export abstract class ResourceAccessGuard implements CanActivate {
	private readonly logger = new Logger(this.constructor.name);

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<ResourceRequest>();
		const authContext = getAuthContext(context, isOrganizationAuthContext);
		const organizationId = await this.resolveOrganizationId(
			context,
			request,
			authContext
		);
		if (organizationId !== authContext.organizationId) {
			throw new NotFoundException(this.notFoundMessage(request));
		}
		return true;
	}

	protected abstract organizationIdOf(
		request: ResourceRequest,
		authContext: OrganizationAuthContext,
		context: ExecutionContext
	): Promise<string | null>;

	protected abstract notFoundMessage(request: ResourceRequest): string;

	private async resolveOrganizationId(
		context: ExecutionContext,
		request: ResourceRequest,
		authContext: OrganizationAuthContext
	): Promise<string | null> {
		try {
			return await this.organizationIdOf(request, authContext, context);
		} catch (error) {
			if (
				!(error instanceof NotFoundException) &&
				!(error instanceof NotFoundError)
			) {
				this.logger.error(error);
			}
			return null;
		}
	}
}
