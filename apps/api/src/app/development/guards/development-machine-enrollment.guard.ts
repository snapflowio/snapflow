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
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CustomHeaders } from '../../../common/constants/header.constants';
import { secretsEqual } from '../../../common/utils/secret-comparison.util';
import { DeploymentEnvironment } from '../../../config/enums/deployment-environment.enum';
import { TypedConfigService } from '../../../config/services/typed-config.service';

@Injectable()
export class DevelopmentMachineEnrollmentGuard implements CanActivate {
	constructor(private readonly config: TypedConfigService) {}

	canActivate(context: ExecutionContext): boolean {
		const { machineEnrollmentSecret } = this.config.get('development');
		if (
			this.config.get('deployment').name !==
				DeploymentEnvironment.DEVELOPMENT ||
			!machineEnrollmentSecret
		) {
			throw new NotFoundException();
		}
		const presented = context
			.switchToHttp()
			.getRequest<Request>()
			.header(CustomHeaders.DEVELOPMENT_ENROLLMENT_SECRET.name);
		if (!presented || !secretsEqual(machineEnrollmentSecret, presented)) {
			throw new UnauthorizedException(
				'The development machine enrollment secret does not match'
			);
		}
		return true;
	}
}
