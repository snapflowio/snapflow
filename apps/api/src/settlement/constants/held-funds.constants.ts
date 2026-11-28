/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const HELD_FUND = {
	ESCROW_BALANCE: 'escrow_balance',
	FROZEN_ESCROW: 'frozen_escrow',
	OPEN_PAYMENT_CHANNELS: 'open_payment_channels',
	HOST_EARNINGS: 'host_earnings',
	LEDGER_CREDIT: 'ledger_credit',
	WALLET_USDC: 'wallet_usdc',
} as const;

export type HeldFund = (typeof HELD_FUND)[keyof typeof HELD_FUND];

export const HELD_FUND_LABEL = {
	[HELD_FUND.ESCROW_BALANCE]: 'an escrow balance',
	[HELD_FUND.FROZEN_ESCROW]: 'escrow funds frozen for review',
	[HELD_FUND.OPEN_PAYMENT_CHANNELS]:
		'payment channels still being billed or paid',
	[HELD_FUND.HOST_EARNINGS]: 'host earnings not yet paid out',
	[HELD_FUND.LEDGER_CREDIT]: 'billing credit Snapflow still owes back',
	[HELD_FUND.WALLET_USDC]: 'USDC in the wallet',
} as const satisfies Record<HeldFund, string>;

export const HeldFundsErrorCode = {
	ORGANIZATION_HOLDS_FUNDS: 'ORGANIZATION_HOLDS_FUNDS',
	ACCOUNT_HOLDS_FUNDS: 'ACCOUNT_HOLDS_FUNDS',
	PAYOUT_WALLET_HOLDS_FUNDS: 'PAYOUT_WALLET_HOLDS_FUNDS',
	FUNDS_UNREADABLE: 'HELD_FUNDS_CHAIN_UNAVAILABLE',
} as const;
