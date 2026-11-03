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
	ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { isBaseAuthContext } from '../../../common/types/base-auth-context.types';
import { SystemRole } from '../../../user/enums/system-role.enum';
import { SettingsService } from '../services/settings.service';

const HTTP_CONTEXT = 'http';

export const AvailableInMaintenance = Reflector.createDecorator<boolean>({
	transform: () => true,
});

@Injectable()
export class MaintenanceGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly settings: SettingsService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (context.getType() !== HTTP_CONTEXT) return true;
		const available = this.reflector.getAllAndOverride(AvailableInMaintenance, [
			context.getHandler(),
			context.getClass(),
		]);
		if (available) return true;
		if (!(await this.settings.get()).maintenanceMode) return true;
		const { user } = context.switchToHttp().getRequest<Request>();
		if (isBaseAuthContext(user) && user.role === SystemRole.ADMIN) return true;
		throw new ServiceUnavailableException(
			'Service is currently under maintenance. Please try again later.'
		);
	}
}
