/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { escrowDomain } from '@snapflow/contracts';
import type { Hex } from 'viem';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SettingsService } from '../../settings/services/settings.service';
import { PaymentChannelErrorCode } from '../constants/payment-channel.constants';
import {
	type ListPaymentChannelsQueryDto,
	PaymentChannelDto,
	type PaymentChannelPageDto,
	PendingVouchersDto,
} from '../dto/payment-channel.dto';
import { PaymentChannel } from '../entities/payment-channel.entity';
import type { PaymentVoucher } from '../entities/payment-voucher.entity';
import {
	latestVouchers,
	VoucherSelection,
} from '../queries/latest-vouchers.query';
import { recentChannels } from '../queries/recent-channels.query';
import { configuredEscrow } from '../utils/escrow-identity.util';

@Injectable()
export class PaymentChannelReadService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly settings: SettingsService
	) {}

	// Newest first, each with its latest voucher.
	async list(
		organizationId: string,
		query: ListPaymentChannelsQueryDto
	): Promise<PaymentChannelPageDto> {
		const manager = this.entityManager.fork();
		const page = await findCursorPage(manager, PaymentChannel, {
			where: {
				...configuredEscrow(this.config),
				customerOrganizationId: organizationId,
			},
			orderBy: { openedAt: QueryOrder.DESC, id: QueryOrder.DESC },
			cursor: query.cursor,
			limit: query.limit,
		});
		const latest = await latestVouchers(
			manager,
			page.items.map(({ id }) => id),
			VoucherSelection.ANY
		);
		return {
			items: page.items.map((channel) =>
				PaymentChannelDto.from(channel, latest.get(channel.id))
			),
			nextCursor: page.nextCursor,
		};
	}

	async get(
		organizationId: string,
		channelId: Hex
	): Promise<PaymentChannelDto> {
		const manager = this.entityManager.fork();
		const channel = await manager.findOne(PaymentChannel, {
			...configuredEscrow(this.config),
			channelId,
			customerOrganizationId: organizationId,
		});
		if (!channel) {
			throw new NotFoundException({
				code: PaymentChannelErrorCode.CHANNEL_NOT_FOUND,
				message: 'Payment channel not found',
			});
		}
		const latest = await latestVouchers(
			manager,
			[channel.id],
			VoucherSelection.ANY
		);
		return PaymentChannelDto.from(channel, latest.get(channel.id));
	}

	// Latest vouchers still waiting for the customer's signature, oldest
	// channel first; a voucher superseded by a newer one is not listed.
	async pending(organizationId: string): Promise<PendingVouchersDto> {
		const manager = this.entityManager.fork();
		const escrow = configuredEscrow(this.config);
		const now = await databaseNow(manager);
		const { voucherLifetimeHours } = await this.settings.get();
		const channels = await recentChannels(
			manager,
			{ ...escrow, customerOrganizationId: organizationId },
			now,
			voucherLifetimeHours
		);
		const latest = await latestVouchers(
			manager,
			channels.map(({ id }) => id),
			VoucherSelection.ANY
		);
		const pending = channels.flatMap(
			(channel): [PaymentChannel, PaymentVoucher][] => {
				const voucher = latest.get(channel.id);
				return voucher && voucher.signature === null && voucher.expiresAt > now
					? [[channel, voucher]]
					: [];
			}
		);
		return PendingVouchersDto.from(
			escrowDomain(escrow.chainId, escrow.contractAddress),
			pending
		);
	}
}
