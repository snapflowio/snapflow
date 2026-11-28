/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Address } from 'viem';
import { AutoTopUpStatus } from '../constants/auto-top-up.constants';
import { AutoTopUp } from '../entities/auto-top-up.entity';
import { EscrowAutoTopUp } from '../entities/escrow-auto-top-up.entity';
import { PaymentWallet } from '../entities/payment-wallet.entity';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import type { EscrowIdentity } from '../types/escrow.types';
import { autoTopUpStatus } from '../utils/auto-top-up/auto-top-up.util';

export interface AutoTopUpState {
	settings: AutoTopUp | null;
	walletAddress: Address | null;
	limits: EscrowAutoTopUp | null;
	status: AutoTopUpStatus;
}

export async function autoTopUpState(
	manager: EntityManager,
	escrow: EscrowIdentity,
	relayer: Address,
	organizationId: string
): Promise<AutoTopUpState> {
	const settings = await manager.findOne(AutoTopUp, { organizationId });
	const wallet = await manager.findOne(PaymentWallet, {
		organizationId,
		purpose: PaymentWalletPurpose.FUNDING,
	});
	const limits = wallet
		? await manager.findOne(EscrowAutoTopUp, {
				...escrow,
				customerAddress: wallet.address,
			})
		: null;
	return {
		settings,
		walletAddress: wallet?.address ?? null,
		limits,
		status: autoTopUpStatus(settings, limits, relayer),
	};
}

export async function autoTopUpHealthy(
	manager: EntityManager,
	escrow: EscrowIdentity,
	relayer: Address,
	organizationId: string
): Promise<boolean> {
	const { status } = await autoTopUpState(
		manager,
		escrow,
		relayer,
		organizationId
	);
	return status === AutoTopUpStatus.ACTIVE;
}
