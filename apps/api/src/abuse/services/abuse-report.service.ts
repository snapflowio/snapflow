/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { errorMessage } from '../../common/utils/error/error.util';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SettingsService } from '../../settings/services/settings.service';
import type { MachineAbuseReportDto } from '../dto/machine-abuse-report.dto';
import { AbuseLadderService } from './abuse-ladder.service';

@Injectable()
export class AbuseReportService {
	private readonly logger = new Logger(AbuseReportService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly ladder: AbuseLadderService
	) {}

	async record(
		machineId: string,
		report: MachineAbuseReportDto
	): Promise<void> {
		if (report.sandboxes.length === 0) return;
		const reported = new Map(
			report.sandboxes.map(({ sandboxId, findings }) => [sandboxId, findings])
		);
		const [sandboxes, { abuseEnforcementMode }] = await Promise.all([
			this.entityManager
				.fork()
				.find(
					Sandbox,
					{ id: { $in: [...reported.keys()] }, machineId },
					{ fields: ['id', 'organizationId', 'name'] }
				),
			this.settings.get(),
		]);
		for (const sandbox of sandboxes) {
			const findings = reported.get(sandbox.id);
			if (!findings) continue;
			await this.ladder
				.escalate(sandbox, machineId, findings, abuseEnforcementMode)
				.catch((error: unknown) =>
					this.logger.error(
						`Could not record abuse signals of sandbox ${sandbox.id}: ${errorMessage(error)}`
					)
				);
		}
	}
}
