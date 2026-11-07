/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_MINUTE } from '../../common/constants/time.constants';
import type { PermissionPair } from '../../organization/utils/organization-permissions.util';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';

export const WALLET_CHALLENGE_TTL_MILLISECONDS = 10 * MILLISECONDS_PER_MINUTE;
export const WALLET_CHALLENGE_KEY_PREFIX = 'settlement:wallet-challenge';
export const SIWE_MESSAGE_VERSION = '1';

export const WALLET_CHALLENGE_STATEMENT: Readonly<
	Record<PaymentWalletPurpose, string>
> = {
	[PaymentWalletPurpose.FUNDING]:
		'Link this wallet to fund Snapflow usage through the USDC escrow.',
	[PaymentWalletPurpose.PAYOUT]:
		'Link this wallet to receive Snapflow host earnings from the USDC escrow.',
};

export const PAYMENT_WALLET_LIMITS = {
	MESSAGE_MAX_LENGTH: 2_048,
	// ERC-6492 signatures of undeployed smart wallets carry the factory calldata.
	SIGNATURE_MAX_LENGTH: 16_384,
} as const;

export const SIGNATURE_PATTERN = /^0x[0-9a-fA-F]+$/;

export const PAYMENT_WALLET_MANAGE_PERMISSION: Readonly<
	Record<PaymentWalletPurpose, PermissionPair>
> = {
	[PaymentWalletPurpose.FUNDING]: { resource: 'billing', action: 'manage' },
	[PaymentWalletPurpose.PAYOUT]: { resource: 'payouts', action: 'manage' },
};

export const PaymentWalletErrorCode = {
	MESSAGE_INVALID: 'wallet_message_invalid',
	CHALLENGE_NOT_FOUND: 'wallet_challenge_not_found',
	SIGNATURE_INVALID: 'wallet_signature_invalid',
	ADDRESS_SANCTIONED: 'wallet_address_sanctioned',
	ADDRESS_IN_USE: 'wallet_address_in_use',
	CHAIN_UNAVAILABLE: 'settlement_chain_unavailable',
	SANCTIONS_SCREENING_UNAVAILABLE: 'sanctions_screening_unavailable',
} as const;

export type PaymentWalletErrorCode =
	(typeof PaymentWalletErrorCode)[keyof typeof PaymentWalletErrorCode];
