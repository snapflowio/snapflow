/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { recordMachinePublicAddress } from '../../../abuse/queries/machine-public-address.query';
import { errorMessage } from '../../../common/utils/error/error.util';
import { publicIpv4Address } from '../../../common/utils/ip-address.util';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { listingTrafficCapGb } from '../../../marketplace/queries/listing-traffic-cap.query';
import { SettingsEvents } from '../../../settings/constants/settings.constants';
import type { SettingsChangedEvent } from '../../../settings/events/settings-changed.event';
import { SettingsService } from '../../../settings/services/settings.service';
import {
	MACHINE_HOST_SETTINGS_WAKE_TOPIC,
	MACHINE_UNCLAIMED_FLOAT_LIMITS,
	MachineHostSettingsErrorCode,
} from '../../constants/machine-host-settings.constants';
import type {
	MachineHostSettingsDocumentDto,
	MachineHostSettingsDto,
} from '../../dto/machine-host-settings.dto';
import { Machine } from '../../entities/machine.entity';
import { MachineState } from '../../enums/machine-state.enum';
import {
	applyMachineHostSettings,
	machineHostSettingsDocument,
} from '../../utils/host-settings/machine-host-settings.util';
import {
	MACHINE_TRAFFIC_SETTING_KEYS,
	machineTrafficPolicy,
} from '../../utils/host-settings/machine-traffic-policy.util';

@Injectable()
export class MachineHostSettingsService {
	private readonly logger = new Logger(MachineHostSettingsService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly wakes: ControlWakeService,
		private readonly settings: SettingsService
	) {}

	async set(
		machineId: string,
		settings: MachineHostSettingsDto
	): Promise<Machine> {
		assertFloatInRange(settings.maxUnclaimedFloat);
		return this.entityManager.fork().transactional(async (manager) => {
			const machine = await manager.findOneOrFail(
				Machine,
				{ id: machineId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			applyMachineHostSettings(machine.hostSettings, settings);
			await manager.flush();
			this.wakes.notifyAfterCommit(manager, MACHINE_HOST_SETTINGS_WAKE_TOPIC, [
				machineId,
			]);
			return machine;
		});
	}

	async document(
		machineId: string,
		clientIp: string | undefined
	): Promise<MachineHostSettingsDocumentDto> {
		const manager = this.entityManager.fork();
		const [machine, monthlyTrafficCapGb, settings] = await Promise.all([
			manager.findOneOrFail(
				Machine,
				{ id: machineId },
				{
					fields: ['hostSettings', 'networkUplinkMbps', 'networkDownlinkMbps'],
				}
			),
			listingTrafficCapGb(manager, machineId),
			this.settings.get(),
		]);
		const publicAddress = publicIpv4Address(clientIp);
		if (publicAddress) {
			await recordMachinePublicAddress(manager, machineId, publicAddress);
		}
		return machineHostSettingsDocument(
			machine.hostSettings,
			machineTrafficPolicy(machine, settings, monthlyTrafficCapGb),
			publicAddress ? [publicAddress] : []
		);
	}

	@OnEvent(SettingsEvents.CHANGED)
	async onSettingsChanged(event: SettingsChangedEvent): Promise<void> {
		if (!event.changed(...MACHINE_TRAFFIC_SETTING_KEYS)) return;
		try {
			const machines = await this.entityManager
				.fork()
				.find(
					Machine,
					{ state: { $ne: MachineState.DECOMMISSIONED } },
					{ fields: ['id'] }
				);
			this.wakes.notify(
				MACHINE_HOST_SETTINGS_WAKE_TOPIC,
				machines.map((machine) => machine.id)
			);
		} catch (error) {
			this.logger.error(
				`Could not wake machines for new traffic settings: ${errorMessage(error)}`
			);
		}
	}
}

function assertFloatInRange(maxUnclaimedFloat: string | null): void {
	if (
		maxUnclaimedFloat === null ||
		BigInt(maxUnclaimedFloat) <= MACHINE_UNCLAIMED_FLOAT_LIMITS.MAXIMUM
	) {
		return;
	}
	throw new BadRequestException({
		code: MachineHostSettingsErrorCode.FLOAT_TOO_LARGE,
		message: `The maximum unclaimed float is at most ${MACHINE_UNCLAIMED_FLOAT_LIMITS.MAXIMUM} USDC base units`,
	});
}
