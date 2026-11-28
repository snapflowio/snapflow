/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	decodeMultiSendTransactions,
	multiSendCallOnlyAbi,
	multiSendCallOnlyAddress,
	SAFE_OWNER_THRESHOLD,
	type SafeCall,
	SafeOperation,
	safeL2Abi,
	snapflowEscrowAbi,
} from '@snapflow/contracts';
import {
	type Abi,
	type Address,
	type ContractFunctionName,
	type DecodeFunctionDataReturnType,
	decodeFunctionData,
	erc20Abi,
	type Hex,
	isAddressEqual,
	zeroAddress,
} from 'viem';
import {
	UserWalletErrorCode,
	WALLET_TRANSACTION_LIMITS,
} from '../../constants/user-wallet.constants';
import { recoveryBlocks } from './wallet-recovery.util';

export interface WalletCallContext {
	safe: Address;
	usdc: Address;
	escrow: Address;
	signer: Address;
	delegatedSigner: Address | null;
	relayer: Address;
	minimumDepositMicroUsd: bigint;
	snapflowControlled: readonly Address[];
}

export type WalletCallVerdict =
	| { allowed: true; outgoing: boolean }
	| { allowed: false; reason: string };

const ESCROW_CUSTOMER_FUNCTIONS = [
	'deposit',
	'depositFor',
	'requestWithdrawal',
	'cancelWithdrawal',
	'completeWithdrawal',
	'authorizeSigner',
	'raiseSignerLimit',
	'lowerSignerLimit',
	'thawSigner',
	'revokeSigner',
	'setAutoTopUp',
	'disableAutoTopUp',
] as const satisfies readonly ContractFunctionName<
	typeof snapflowEscrowAbi,
	'nonpayable'
>[];

const SAFE_OWNER_FUNCTIONS = [
	'addOwnerWithThreshold',
	'removeOwner',
	'swapOwner',
] as const satisfies readonly ContractFunctionName<
	typeof safeL2Abi,
	'nonpayable'
>[];

const ESCROW_FUNCTIONS: ReadonlySet<string> = new Set(
	ESCROW_CUSTOMER_FUNCTIONS
);
const OWNER_FUNCTIONS: ReadonlySet<string> = new Set(SAFE_OWNER_FUNCTIONS);

const ALLOWED = { allowed: true, outgoing: false } as const;
const OUTGOING = { allowed: true, outgoing: true } as const;

function refused(reason: string): WalletCallVerdict {
	return { allowed: false, reason };
}

export function decodedCall<const TAbi extends Abi>(
	abi: TAbi,
	data: Hex
): DecodeFunctionDataReturnType<TAbi> | null {
	try {
		return decodeFunctionData({ abi, data });
	} catch {
		return null;
	}
}

function usdcCall(data: Hex, context: WalletCallContext): WalletCallVerdict {
	const call = decodedCall(erc20Abi, data);
	switch (call?.functionName) {
		case 'transfer':
			return OUTGOING;
		case 'approve':
			return isAddressEqual(call.args[0], context.escrow)
				? ALLOWED
				: refused('USDC may only be approved for the escrow');
		default:
			return refused('Only USDC transfer and approve are relayed');
	}
}

function depositVerdict(
	amount: bigint,
	verdict: WalletCallVerdict,
	context: WalletCallContext
): WalletCallVerdict {
	return amount < context.minimumDepositMicroUsd
		? refused(
				`Deposits are at least ${context.minimumDepositMicroUsd} USDC base units`
			)
		: verdict;
}

function isDelegatedSigner(
	signer: Address,
	context: WalletCallContext
): boolean {
	return (
		context.delegatedSigner !== null &&
		isAddressEqual(signer, context.delegatedSigner)
	);
}

function escrowCall(data: Hex, context: WalletCallContext): WalletCallVerdict {
	const call = decodedCall(snapflowEscrowAbi, data);
	if (!call || !ESCROW_FUNCTIONS.has(call.functionName)) {
		return refused('Only escrow customer functions are relayed');
	}
	switch (call.functionName) {
		case 'deposit':
			return depositVerdict(call.args[0], ALLOWED, context);
		case 'depositFor':
			return depositVerdict(
				call.args[1],
				isAddressEqual(call.args[0], context.safe) ? ALLOWED : OUTGOING,
				context
			);
		case 'setAutoTopUp':
			return isAddressEqual(call.args[0], context.relayer) ? ALLOWED : OUTGOING;
		case 'authorizeSigner':
			return isDelegatedSigner(call.args[0], context) ? ALLOWED : OUTGOING;
		case 'raiseSignerLimit':
		case 'lowerSignerLimit':
			return isDelegatedSigner(call.args[0], context)
				? ALLOWED
				: refused(
						"Only the limit of Snapflow's delegated signer for this wallet is changed through the relayer"
					);
		default:
			return ALLOWED;
	}
}

function newOwnerVerdict(
	owner: Address,
	context: WalletCallContext
): WalletCallVerdict {
	if (
		isAddressEqual(owner, zeroAddress) ||
		isAddressEqual(owner, context.safe)
	) {
		return refused('The new owner is not a valid address');
	}
	return context.snapflowControlled.some((controlled) =>
		isAddressEqual(controlled, owner)
	)
		? refused('An address Snapflow controls never owns a wallet')
		: ALLOWED;
}

function ownerCall(data: Hex, context: WalletCallContext): WalletCallVerdict {
	const call = decodedCall(safeL2Abi, data);
	if (!call || !OWNER_FUNCTIONS.has(call.functionName)) {
		return refused(
			'Only Safe owner management is relayed on the wallet itself'
		);
	}
	switch (call.functionName) {
		case 'addOwnerWithThreshold': {
			const [owner, threshold] = call.args;
			if (threshold !== SAFE_OWNER_THRESHOLD) {
				return refused('Owners are added with a threshold of one');
			}
			return newOwnerVerdict(owner, context);
		}
		case 'removeOwner': {
			const [, owner, threshold] = call.args;
			if (threshold !== SAFE_OWNER_THRESHOLD) {
				return refused('The threshold stays at one');
			}
			return isAddressEqual(owner, context.signer)
				? refused('The passkey owner cannot be removed through the relayer')
				: ALLOWED;
		}
		case 'swapOwner': {
			const [, oldOwner, newOwner] = call.args;
			return isAddressEqual(oldOwner, context.signer)
				? refused('The passkey owner cannot be replaced through the relayer')
				: newOwnerVerdict(newOwner, context);
		}
		default:
			return refused(
				'Only Safe owner management is relayed on the wallet itself'
			);
	}
}

function plainCall(
	to: Address,
	data: Hex,
	context: WalletCallContext
): WalletCallVerdict {
	if (isAddressEqual(to, context.usdc)) return usdcCall(data, context);
	if (isAddressEqual(to, context.escrow)) return escrowCall(data, context);
	if (isAddressEqual(to, context.safe)) return ownerCall(data, context);
	return refused('The target contract is not on the relay allowlist');
}

function batchCall(data: Hex, context: WalletCallContext): WalletCallVerdict {
	const call = decodedCall(multiSendCallOnlyAbi, data);
	if (!call) return refused('Only MultiSendCallOnly.multiSend is relayed');
	let calls: ReturnType<typeof decodeMultiSendTransactions>;
	try {
		calls = decodeMultiSendTransactions(call.args[0]);
	} catch {
		return refused('The MultiSend batch is malformed');
	}
	if (
		calls.length === 0 ||
		calls.length > WALLET_TRANSACTION_LIMITS.MULTI_SEND_MAX_CALLS
	) {
		return refused(
			`A batch carries 1 to ${WALLET_TRANSACTION_LIMITS.MULTI_SEND_MAX_CALLS} calls`
		);
	}
	let outgoing = false;
	for (const inner of calls) {
		if (inner.operation !== SafeOperation.CALL || inner.value !== 0n) {
			return refused('Batched calls are plain calls without ETH');
		}
		if (isAddressEqual(inner.to, context.safe)) {
			return refused('Owner changes are relayed on their own, not batched');
		}
		const verdict = plainCall(inner.to, inner.data, context);
		if (!verdict.allowed) return verdict;
		outgoing ||= verdict.outgoing;
	}
	return { allowed: true, outgoing };
}

function walletCallVerdict(
	call: SafeCall,
	context: WalletCallContext
): WalletCallVerdict {
	if (call.value !== 0n) return refused('Relayed transactions carry no ETH');
	if (call.operation === SafeOperation.DELEGATE_CALL) {
		return isAddressEqual(call.to, multiSendCallOnlyAddress)
			? batchCall(call.data, context)
			: refused('Delegate calls only reach MultiSendCallOnly');
	}
	return plainCall(call.to, call.data, context);
}

export function walletCallNewOwners(call: SafeCall, safe: Address): Address[] {
	if (call.operation !== SafeOperation.CALL || !isAddressEqual(call.to, safe)) {
		return [];
	}
	const decoded = decodedCall(safeL2Abi, call.data);
	switch (decoded?.functionName) {
		case 'addOwnerWithThreshold':
			return [decoded.args[0]];
		case 'swapOwner':
			return [decoded.args[2]];
		default:
			return [];
	}
}

export interface WalletCallRefusal {
	code: UserWalletErrorCode;
	message: string;
}

export function walletCallRefusal(
	call: SafeCall,
	context: WalletCallContext,
	owners: readonly Address[]
): WalletCallRefusal | null {
	const verdict = walletCallVerdict(call, context);
	if (!verdict.allowed) {
		return {
			code: UserWalletErrorCode.CALL_NOT_ALLOWED,
			message: verdict.reason,
		};
	}
	if (recoveryBlocks(verdict, owners, context.signer)) {
		return {
			code: UserWalletErrorCode.RECOVERY_OWNER_REQUIRED,
			message:
				'Add a recovery owner to your wallet before moving USDC out of it',
		};
	}
	return null;
}
