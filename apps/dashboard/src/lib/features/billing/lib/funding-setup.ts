/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type EscrowAccount,
	EscrowSignerStatus,
	type VoucherDelegation,
} from '@snapflow/api-client';
import { FundingDialog } from '#lib/routing/funding-dialog.ts';
import { escrowDepositedMicroUsd } from './escrow-balance.ts';

export interface FundingSetupStep {
	title: string;
	action: string;
	dialog: FundingDialog;
	done: boolean;
}

export function fundingSetupSteps(
	account: EscrowAccount,
	delegation: VoucherDelegation | undefined
): FundingSetupStep[] {
	return [
		{
			title: 'Link a funding wallet',
			action: 'Link wallet',
			dialog: FundingDialog.FundingWallet,
			done: account.fundingWalletAddress !== null,
		},
		{
			title: 'Deposit USDC',
			action: 'Add funds',
			dialog: FundingDialog.Deposit,
			done: BigInt(escrowDepositedMicroUsd(account)) > 0n,
		},
		{
			title: 'Turn on automatic payments',
			action: 'Turn on',
			dialog: FundingDialog.AutomaticPayments,
			done: delegation?.delegatedSigner?.status === EscrowSignerStatus.Active,
		},
	];
}

export function fundingSetupComplete(
	steps: readonly FundingSetupStep[]
): boolean {
	return steps.every((step) => step.done);
}

export function currentSetupStep(
	steps: readonly FundingSetupStep[]
): FundingSetupStep | null {
	return steps.find((step) => !step.done) ?? null;
}
