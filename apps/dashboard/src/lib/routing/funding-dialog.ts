/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const FUNDING_DIALOG_PARAM = 'dialog';

export const FundingDialog = {
	Deposit: 'deposit',
	Withdraw: 'withdraw',
	FundingWallet: 'funding-wallet',
	AutomaticPayments: 'automatic-payments',
	SignerLimit: 'signer-limit',
	AutoTopUp: 'auto-top-up',
	SpendLimits: 'spend-limits',
} as const;

export type FundingDialog = (typeof FundingDialog)[keyof typeof FundingDialog];
