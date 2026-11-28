/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const SettlementTransactionKind = {
	HOST_SETTLEMENT: 'host_settlement',
	CLAIM_BATCH: 'claim_batch',
	WITHDRAW_HOST: 'withdraw_host',
	SWEEP_FEES: 'sweep_fees',
	WALLET_TRANSACTION: 'wallet_transaction',
	AUTO_TOP_UP: 'auto_top_up',
	PAUSE_ESCROW: 'pause_escrow',
} as const;

export type SettlementTransactionKind =
	(typeof SettlementTransactionKind)[keyof typeof SettlementTransactionKind];
