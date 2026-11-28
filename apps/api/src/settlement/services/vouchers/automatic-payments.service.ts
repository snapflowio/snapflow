/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { feeBpsForMarkup } from '@snapflow/contracts';
import { SettingsService } from '../../../settings/services/settings.service';
import { PaymentWallet } from '../../entities/payment-wallet.entity';
import { PaymentWalletPurpose } from '../../enums/payment-wallet-purpose.enum';
import { VoucherLimit } from '../../enums/voucher-limit.enum';
import { VoucherSigningMode } from '../../enums/voucher-signing-mode.enum';
import { AutomaticPaymentsRequiredException } from '../../exceptions/automatic-payments-required.exception';
import { committedHourlySpend } from '../../queries/committed-hourly-spend.query';
import type { AutomaticPaymentsGap } from '../../types/automatic-payments.types';
import { ChainClockService } from '../escrow/chain-clock.service';
import { VoucherSignerScopeService } from './voucher-signer-scope.service';

@Injectable()
export class AutomaticPaymentsService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly chainClock: ChainClockService,
		private readonly scopes: VoucherSignerScopeService
	) {}

	async gap(
		manager: EntityManager,
		organizationId: string
	): Promise<AutomaticPaymentsGap | null> {
		const wallet = await manager.findOne(
			PaymentWallet,
			{ organizationId, purpose: PaymentWalletPurpose.FUNDING },
			{ fields: ['address'] }
		);
		if (!wallet) return null;
		const { markupBasisPoints } = await this.settings.get();
		const hourlySpendMicroUsd = await committedHourlySpend(
			manager,
			organizationId
		);
		const signer = await this.scopes.forAdmission(manager, {
			customerAddress: wallet.address,
			at: await this.chainClock.now(),
			feeBps: feeBpsForMarkup(markupBasisPoints),
			hourlySpendMicroUsd,
		});
		if (!signer) return null;
		return {
			limit: signer.limit,
			hourlyCapMicroUsd: signer.hourlyCapMicroUsd,
			hourlySpendMicroUsd,
			expiresAt:
				signer.limit === VoucherLimit.SIGNER_EXPIRED
					? (signer.grant?.expiresAt ?? null)
					: null,
		};
	}

	async assertSignable(
		organizationId: string,
		signingMode: VoucherSigningMode
	): Promise<void> {
		if (signingMode !== VoucherSigningMode.DELEGATED) return;
		const gap = await this.gap(this.entityManager.fork(), organizationId);
		if (gap) throw new AutomaticPaymentsRequiredException(gap);
	}
}
