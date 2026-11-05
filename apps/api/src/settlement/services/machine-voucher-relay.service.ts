/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { escrowDomain } from '@snapflow/contracts';
import { canonicalJson } from '../../common/utils/canonical-json.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SettingsService } from '../../settings/services/settings.service';
import {
	MachineSignedVoucherDto,
	type MachineVoucherRelayDto,
} from '../dto/machine-voucher-relay.dto';
import { EscrowDomainDto } from '../dto/payment-channel.dto';
import {
	latestVouchers,
	VoucherSelection,
} from '../queries/latest-vouchers.query';
import { recentChannels } from '../queries/recent-channels.query';
import { configuredEscrow } from '../utils/escrow-identity.util';

const DIGEST_ALGORITHM = 'sha256';
const DIGEST_ENCODING = 'hex';

// The latest signed voucher of every channel whose sandbox runs on a
// machine, for the machine to check that it is still being paid.
@Injectable()
export class MachineVoucherRelayService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly settings: SettingsService
	) {}

	async build(machineId: string): Promise<MachineVoucherRelayDto> {
		const manager = this.entityManager.fork();
		const escrow = configuredEscrow(this.config);
		const settings = await this.settings.get();
		const channels = await recentChannels(
			manager,
			{ ...escrow, machineId },
			await databaseNow(manager),
			settings.voucherLifetimeHours
		);
		const latest = await latestVouchers(
			manager,
			channels.map(({ id }) => id),
			VoucherSelection.SIGNED
		);
		const document = {
			domain: EscrowDomainDto.from(
				escrowDomain(escrow.chainId, escrow.contractAddress)
			),
			voucherIntervalSeconds: settings.voucherIntervalSeconds,
			voucherGraceIntervals: settings.voucherGraceIntervals,
			channels: channels.map((channel) => {
				const voucher = latest.get(channel.id);
				return {
					sandboxId: channel.sandboxId,
					leaseId: channel.leaseId,
					channelId: channel.channelId,
					state: channel.state,
					voucher: voucher
						? MachineSignedVoucherDto.fromSigned(channel, voucher)
						: null,
				};
			}),
		};
		return {
			digest: createHash(DIGEST_ALGORITHM)
				.update(canonicalJson(document))
				.digest(DIGEST_ENCODING),
			...document,
		};
	}
}
