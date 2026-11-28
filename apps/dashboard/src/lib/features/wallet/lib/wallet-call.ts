/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	PublicSettlementConfig,
	WalletTransaction,
} from '@snapflow/api-client';
import {
	type MultiSendCall,
	type SafeCall,
	safeCallBatch,
	snapflowEscrowAbi,
} from '@snapflow/contracts';
import {
	type DecodeFunctionDataReturnType,
	decodeFunctionData,
	erc20Abi,
	getAddress,
	isAddress,
	isHex,
} from 'viem';
import { unixSecondsDate } from '#lib/features/billing/lib/escrow-terms.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { formatHourlyPrice, formatUsd } from '#lib/utils/usd.ts';
import { sameAddress, shortAddress } from './payment-wallet.ts';

export type WalletCallContracts = Pick<
	PublicSettlementConfig,
	'escrowAddress' | 'usdcAddress'
>;

export const WalletCallDetail = {
	Amount: 'Amount',
	Limit: 'Hourly spending limit',
	Terms: 'Terms',
	Address: 'Address',
} as const;

export type WalletCallDetail =
	(typeof WalletCallDetail)[keyof typeof WalletCallDetail];

export interface WalletCallAction {
	label: string;
	detail: string | null;
	detailLabel: WalletCallDetail;
	supporting: boolean;
}

type EscrowCall = DecodeFunctionDataReturnType<typeof snapflowEscrowAbi>;
type TokenCall = DecodeFunctionDataReturnType<typeof erc20Abi>;

const RELAYED_VALUE = 0n;
const ESCROW_CALL_LABEL = 'Escrow call';
const CONTRACT_CALL_LABEL = 'Contract call';

function action(
	label: string,
	detail: string | null = null,
	detailLabel: WalletCallDetail = WalletCallDetail.Amount,
	supporting = false
): WalletCallAction {
	return { label, detail, detailLabel, supporting };
}

function usd(amount: bigint): string {
	return formatUsd(amount.toString());
}

function hourly(amount: bigint): string {
	return formatHourlyPrice(amount.toString());
}

function escrowAction(call: EscrowCall): WalletCallAction {
	switch (call.functionName) {
		case 'deposit':
		case 'depositWithPermit':
			return action('Deposit to escrow', usd(call.args[0]));
		case 'depositFor':
			return action('Deposit to escrow', usd(call.args[1]));
		case 'requestWithdrawal':
			return action('Request withdrawal', usd(call.args[0]));
		case 'cancelWithdrawal':
			return action('Cancel the requested withdrawal');
		case 'completeWithdrawal':
			return action('Complete the withdrawal to your funding wallet');
		case 'setAutoTopUp': {
			const [, amount, threshold] = call.args;
			return action(
				'Turn on auto top-up',
				`${usd(amount)} when below ${usd(threshold)}`,
				WalletCallDetail.Terms
			);
		}
		case 'disableAutoTopUp':
			return action('Turn off auto top-up');
		case 'authorizeSigner': {
			const [, scope] = call.args;
			return action(
				'Turn on automatic payments',
				`${hourly(scope.hourlyCap)} until ${formatDateTime(unixSecondsDate(scope.expiry))}`,
				WalletCallDetail.Limit
			);
		}
		case 'raiseSignerLimit':
			return action(
				'Raise the hourly spending limit',
				hourly(call.args[1]),
				WalletCallDetail.Limit
			);
		case 'lowerSignerLimit':
			return action(
				'Lower the hourly spending limit',
				hourly(call.args[1]),
				WalletCallDetail.Limit
			);
		case 'thawSigner':
			return action('Stop automatic payments');
		case 'revokeSigner':
			return action('Revoke the automatic payments key');
		case 'setPayoutAddress':
			return action(
				'Set the payout address',
				shortAddress(call.args[0]),
				WalletCallDetail.Address
			);
		case 'withdrawHost':
			return action('Pay out earnings to your payout address');
		default:
			return action(
				ESCROW_CALL_LABEL,
				call.functionName,
				WalletCallDetail.Terms
			);
	}
}

function tokenAction(
	call: TokenCall,
	contracts: WalletCallContracts
): WalletCallAction {
	switch (call.functionName) {
		case 'transfer': {
			const [recipient, amount] = call.args;
			return action(`Send USDC to ${shortAddress(recipient)}`, usd(amount));
		}
		case 'approve': {
			const [spender, amount] = call.args;
			return sameAddress(spender, contracts.escrowAddress)
				? action(
						'Let the escrow pull USDC',
						usd(amount),
						WalletCallDetail.Amount,
						true
					)
				: action(`Let ${shortAddress(spender)} spend USDC`, usd(amount));
		}
		default:
			return action('USDC call', call.functionName, WalletCallDetail.Terms);
	}
}

function callAction(
	call: MultiSendCall,
	contracts: WalletCallContracts
): WalletCallAction {
	try {
		if (sameAddress(call.to, contracts.escrowAddress)) {
			return escrowAction(
				decodeFunctionData({ abi: snapflowEscrowAbi, data: call.data })
			);
		}
		if (sameAddress(call.to, contracts.usdcAddress)) {
			return tokenAction(
				decodeFunctionData({ abi: erc20Abi, data: call.data }),
				contracts
			);
		}
	} catch {
		return action(
			CONTRACT_CALL_LABEL,
			shortAddress(call.to),
			WalletCallDetail.Address
		);
	}
	return action(
		CONTRACT_CALL_LABEL,
		shortAddress(call.to),
		WalletCallDetail.Address
	);
}

function userCalls(
	calls: readonly MultiSendCall[],
	contracts: WalletCallContracts
): readonly MultiSendCall[] {
	const fee = calls.at(-1);
	return calls.length > 1 && fee && sameAddress(fee.to, contracts.usdcAddress)
		? calls.slice(0, -1)
		: calls;
}

export function walletCallActions(
	call: SafeCall,
	contracts: WalletCallContracts
): WalletCallAction[] {
	let calls: MultiSendCall[];
	try {
		calls = safeCallBatch(call);
	} catch {
		return [];
	}
	return userCalls(calls, contracts).map((each) => callAction(each, contracts));
}

export function walletTransactionCall(
	transaction: Pick<WalletTransaction, 'to' | 'data' | 'operation'>
): SafeCall | null {
	const { to, data, operation } = transaction;
	if (!(isAddress(to) && isHex(data))) return null;
	return { to: getAddress(to), value: RELAYED_VALUE, data, operation };
}

export function walletCallSummary(
	actions: readonly WalletCallAction[]
): string | null {
	const primary = actions.filter((each) => !each.supporting);
	const shown = primary.length > 0 ? primary : actions;
	if (shown.length === 0) return null;
	return shown
		.map((each) => (each.detail ? `${each.label}: ${each.detail}` : each.label))
		.join(', ');
}
