/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { apiError } from '../../../common/utils/error/api-error.util';
import { SettingsService } from '../../../settings/services/settings.service';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import {
	resolveAutoArchiveInterval,
	resolveAutoStopInterval,
} from '../../utils/runtime/sandbox-interval.util';
import { requireCustomerLabels } from '../../utils/sandbox-labels.util';
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
		return this.update(sandboxIdOrName, organizationId, () => ({
			labels: labels && requireCustomerLabels(labels),
		}));
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
		return this.update(sandboxIdOrName, organizationId, () => ({
			autoArchiveInterval: resolveAutoArchiveInterval(interval),
		}));
	}

	setAutoDeleteInterval(
		sandboxIdOrName: string,
		interval: number,
		organizationId: string
	): Promise<Sandbox> {
		return this.update(sandboxIdOrName, organizationId, (sandbox) => {
			if (sandbox.gpu > 0) {
				throw new BadRequestException(
					apiError(
						SandboxErrorCode.MODE_INVALID,
						'GPU sandboxes must stay ephemeral. Keep the current mode.'
					)
				);
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
