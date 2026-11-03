/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { SettingsService } from '../../../../settings/platform/services/settings.service';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import {
	resolveAutoArchiveInterval,
	resolveAutoStopInterval,
	retentionArchiveMinutes,
} from '../../utils/runtime/sandbox-interval.util';
import { SandboxService } from './sandbox.service';

@Injectable()
export class SandboxSettingsService {
	constructor(
		private readonly sandboxService: SandboxService,
		private readonly sandboxRepository: SandboxRepository,
		private readonly settings: SettingsService
	) {}

	replaceLabels(
		sandboxIdOrName: string,
		labels: Sandbox['labels'],
		organizationId: string
	): Promise<Sandbox> {
		return this.update(sandboxIdOrName, organizationId, () => ({ labels }));
	}

	setAutostopInterval(
		sandboxIdOrName: string,
		interval: number,
		organizationId: string
	): Promise<Sandbox> {
		return this.update(sandboxIdOrName, organizationId, () => ({
			autoStopInterval: resolveAutoStopInterval(interval),
		}));
	}

	async setAutoArchiveInterval(
		sandboxIdOrName: string,
		interval: number,
		organizationId: string
	): Promise<Sandbox> {
		const maximum = retentionArchiveMinutes(await this.settings.get());
		return this.update(sandboxIdOrName, organizationId, () => ({
			autoArchiveInterval: resolveAutoArchiveInterval(interval, maximum),
		}));
	}

	setAutoDeleteInterval(
		sandboxIdOrName: string,
		interval: number,
		organizationId: string
	): Promise<Sandbox> {
		return this.update(sandboxIdOrName, organizationId, (sandbox) => {
			if (sandbox.gpu > 0) {
				throw new BadRequestException('GPU sandboxes must remain ephemeral');
			}
			return { autoDeleteInterval: interval };
		});
	}

	private async update(
		sandboxIdOrName: string,
		organizationId: string,
		changeFor: (sandbox: Sandbox) => Partial<Sandbox>
	): Promise<Sandbox> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);

		return this.sandboxRepository.update(sandbox.id, {
			updateData: changeFor(sandbox),
			entity: sandbox,
		});
	}
}
