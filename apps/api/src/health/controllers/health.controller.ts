/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Controller,
	Get,
	Logger,
	ServiceUnavailableException,
	UseGuards,
} from '@nestjs/common';
import {
	HealthCheck,
	HealthCheckService,
	MikroOrmHealthIndicator,
} from '@nestjs/terminus';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { AnonymousRateLimitGuard } from '../../common/guards/anonymous-rate-limit.guard';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import { BUILD_PROVENANCE } from '../../config/constants/build-provenance.constants';
import { AvailableInMaintenance } from '../../settings/guards/maintenance.guard';
import { HealthCheckAuthContextGuard } from '../guards/health-check-auth-context.guard';
import { RedisHealthIndicator } from '../services/redis-health.service';

const DEPLOYMENT_APPLICATION = 'api';

const RELEASE_METADATA = {
	application: DEPLOYMENT_APPLICATION,
	release: BUILD_PROVENANCE.version,
	revision: BUILD_PROVENANCE.sourceRevision,
} as const;

@Controller('health')
@AvailableInMaintenance()
export class HealthController {
	private readonly logger = new Logger(HealthController.name);

	constructor(
		private health: HealthCheckService,
		private db: MikroOrmHealthIndicator,
		private redis: RedisHealthIndicator
	) {}

	@Get()
	@PublicEndpoint()
	@UseGuards(AnonymousRateLimitGuard)
	live() {
		return { status: 'ok', ...RELEASE_METADATA };
	}

	@Get('ready')
	@AllowAuthMethods([AuthMethod.API_KEY])
	@UseGuards(AuthenticatedRateLimitGuard)
	@UseGuards(HealthCheckAuthContextGuard)
	@HealthCheck()
	async check() {
		try {
			const result = await this.health.check([
				() => this.db.pingCheck('database'),
				() => this.redis.isHealthy('redis'),
			]);
			return { status: result.status };
		} catch (error) {
			this.logger.error(error);
			throw new ServiceUnavailableException();
		}
	}
}
