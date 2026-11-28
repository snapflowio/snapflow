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
import { Injectable } from '@nestjs/common';
import { escrowDomain } from '@snapflow/contracts';
import { findCursorPage } from '../../../common/utils/pagination/cursor-page.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import {
	type ListPaymentChannelsQueryDto,
	PaymentChannelDto,
	type PaymentChannelPageDto,
	PendingVouchersDto,
} from '../../dto/payment-channel.dto';
import { PaymentChannel } from '../../entities/payment-channel.entity';
import { PaymentChannelCharge } from '../../entities/payment-channel-charge.entity';
import type { SettlementParty } from '../../enums/settlement-party.enum';
import { VoucherSigningMode } from '../../enums/voucher-signing-mode.enum';
import { PaymentChannelNotFoundException } from '../../exceptions/payment-channel-not-found.exception';
import {
	latestVouchers,
	VoucherSelection,
} from '../../queries/latest-vouchers.query';
import type { ChannelVoucher } from '../../types/payment-channel.types';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import { partyFilter } from '../../utils/settlement-party.util';

@Injectable()
export class PaymentChannelReadService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService
	) {}

	async list(
		organizationId: string,
		parties: readonly SettlementParty[],
		query: ListPaymentChannelsQueryDto
	): Promise<PaymentChannelPageDto> {
		const manager = this.entityManager.fork();
		const page = await findCursorPage(manager, PaymentChannel, {
			where: {
				...configuredEscrow(this.config),
				...partyFilter(organizationId, parties),
			},
			orderBy: { createdAt: QueryOrder.DESC, id: QueryOrder.DESC },
			cursor: query.cursor,
			limit: query.limit,
		});
		return {
			items: await this.describe(manager, page.items),
			nextCursor: page.nextCursor,
		};
	}

	async get(
		organizationId: string,
		parties: readonly SettlementParty[],
		paymentChannelId: string
	): Promise<PaymentChannelDto> {
		const manager = this.entityManager.fork();
		const channel = await manager.findOne(PaymentChannel, {
			...configuredEscrow(this.config),
			...partyFilter(organizationId, parties),
			id: paymentChannelId,
		});
		if (!channel) throw new PaymentChannelNotFoundException();
		const [described] = await this.describe(manager, [channel]);
		if (!described) throw new PaymentChannelNotFoundException();
		return described;
	}

	async pending(organizationId: string): Promise<PendingVouchersDto> {
		const manager = this.entityManager.fork();
		const escrow = configuredEscrow(this.config);
		const channels = await manager.find(
			PaymentChannel,
			{
				...escrow,
				customerOrganizationId: organizationId,
				signingMode: VoucherSigningMode.CLIENT,
			},
			{ orderBy: { createdAt: QueryOrder.ASC } }
		);
		const latest = await latestVouchers(
			manager,
			channels.map(({ id }) => id),
			VoucherSelection.ANY
		);
		const pending = channels.flatMap((channel): ChannelVoucher[] => {
			const voucher = latest.get(channel.id);
			return voucher && voucher.signature === null
				? [{ channel, voucher }]
				: [];
		});
		return PendingVouchersDto.from(
			escrowDomain(escrow.chainId, escrow.contractAddress),
			pending
		);
	}

	private async describe(
		manager: EntityManager,
		channels: readonly PaymentChannel[]
	): Promise<PaymentChannelDto[]> {
		const ids = channels.map(({ id }) => id);
		const latest = await latestVouchers(manager, ids, VoucherSelection.ANY);
		const charges =
			ids.length === 0
				? []
				: await manager.find(
						PaymentChannelCharge,
						{ paymentChannelId: { $in: ids } },
						{ orderBy: { createdAt: QueryOrder.ASC } }
					);
		return channels.map((channel) =>
			PaymentChannelDto.from(
				channel,
				charges.filter(
					({ paymentChannelId }) => paymentChannelId === channel.id
				),
				latest.get(channel.id)
			)
		);
	}
}
