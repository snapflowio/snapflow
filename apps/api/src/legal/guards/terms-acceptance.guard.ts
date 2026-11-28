/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { isPublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import {
	HTTP_METHOD,
	SAFE_HTTP_METHODS,
} from '../../common/constants/http-method.constants';
import { isOrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { TermsAcceptanceExempt } from '../decorators/terms-acceptance-exempt.decorator';
import {
	hasAcceptedTerms,
	termsAcceptanceRequired,
} from '../utils/terms-acceptance.util';

const TERMS_FREE_METHODS: ReadonlySet<string> = new Set([
	...SAFE_HTTP_METHODS,
	HTTP_METHOD.DELETE,
]);

@Injectable()
export class TermsAcceptanceGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request>();
		if (
			TERMS_FREE_METHODS.has(request.method.toUpperCase()) ||
			isPublicEndpoint(context, this.reflector) ||
			this.reflector.getAllAndOverride(TermsAcceptanceExempt, [
				context.getHandler(),
				context.getClass(),
			])?.(request) === true
		) {
			return true;
		}
		const { user } = request;
		if (!isOrganizationAuthContext(user) || hasAcceptedTerms(user)) {
			return true;
		}
		throw termsAcceptanceRequired(user.credential);
	}
}
