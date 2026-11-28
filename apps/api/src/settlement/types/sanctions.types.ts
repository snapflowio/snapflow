/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Address } from 'viem';
import type { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';

export interface SdnAddress {
	readonly address: Address;
	readonly sdnEntryUid: number;
	readonly entityName: string;
	readonly currency: string;
}

export interface SdnPublication {
	readonly publishedAt: Date;
	readonly recordCount: number;
	readonly addresses: readonly SdnAddress[];
}

export interface ScreenedPaymentWallet {
	readonly id: string;
	readonly organizationId: string;
	readonly purpose: PaymentWalletPurpose;
	readonly address: Address;
}

export type SanctionedWallet = Pick<
	ScreenedPaymentWallet,
	'organizationId' | 'purpose' | 'address'
>;

export interface SanctionsListChanges {
	readonly added: number;
	readonly removed: readonly Address[];
	readonly blocked: readonly ScreenedPaymentWallet[];
	readonly delisted: readonly ScreenedPaymentWallet[];
}
