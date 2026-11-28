/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const USER_WALLET_SALT_NONCE = 0n;

export const WALLET_TRANSACTION_LIMITS = {
	DATA_MAX_LENGTH: 16_384,
	SIGNATURE_MAX_LENGTH: 4_096,
	MULTI_SEND_MAX_CALLS: 10,
	FEE_MAX_DIGITS: 20,
	LIST_MAX: 50,
	OPEN_MAX: 10,
} as const;

export const WALLET_GAS = {
	TRANSACTION: 21_000n,
	CALLDATA_ZERO_BYTE: 4n,
	CALLDATA_NONZERO_BYTE: 16n,
	SAFE_EXECUTION: 70_000n,
	SIGNATURE_BYTES: 512,
} as const;

export const WALLET_RELAYER = {
	BATCH_SIZE: 20,
	GAS_LIMIT_MARGIN_BASIS_POINTS: 2_500n,
} as const;

export const HEX_DATA_PATTERN = /^0x([0-9a-fA-F]{2})*$/;

export const UserWalletErrorCode = {
	WALLET_NOT_FOUND: 'user_wallet_not_found',
	WALLET_EXISTS: 'user_wallet_exists',
	PASSKEY_NOT_FOUND: 'wallet_passkey_not_found',
	PASSKEY_NOT_WALLET_CAPABLE: 'wallet_passkey_not_p256',
	SIGNER_NOT_OWNER: 'wallet_signer_not_owner',
	CALL_NOT_ALLOWED: 'wallet_call_not_allowed',
	COUNTERPARTY_SANCTIONED: 'wallet_counterparty_sanctioned',
	RECOVERY_OWNER_REQUIRED: 'wallet_recovery_owner_required',
	RECOVERY_OWNER_INVALID: 'wallet_recovery_owner_invalid',
	RECOVERY_OWNER_EXISTS: 'wallet_recovery_owner_exists',
	NONCE_MISMATCH: 'wallet_nonce_mismatch',
	SIGNATURE_INVALID: 'wallet_signature_invalid',
	SIMULATION_FAILED: 'wallet_transaction_simulation_failed',
	QUEUE_FULL: 'wallet_relay_queue_full',
	INSUFFICIENT_FUNDS: 'wallet_insufficient_usdc_for_gas',
	FEE_TOO_LOW: 'wallet_fee_too_low',
	FEE_ABOVE_CAP: 'wallet_fee_above_cap',
	FEE_INVALID: 'wallet_fee_invalid',
	TRANSACTION_NOT_FOUND: 'wallet_transaction_not_found',
} as const;

export type UserWalletErrorCode =
	(typeof UserWalletErrorCode)[keyof typeof UserWalletErrorCode];
