/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { snapflowEscrowAbi } from '@snapflow/contracts';
import {
	type Config,
	readContract,
	simulateContract,
	waitForTransactionReceipt,
	writeContract,
} from '@wagmi/core';
import { type Address, erc20Abi, type Hash } from 'viem';
import { walletError } from './wallet-error.ts';

export interface EscrowWallet {
	config: Config;
	chainId: number;
	account: Address;
	escrow: Address;
	usdc: Address;
}

export interface SessionKeyGrant {
	key: Address;
	spendCap: bigint;
	hourlyCap: bigint;
	expiry: bigint;
}

async function confirmed(
	wallet: EscrowWallet,
	send: () => Promise<Hash>
): Promise<Hash> {
	try {
		const hash = await send();
		await waitForTransactionReceipt(wallet.config, {
			hash,
			chainId: wallet.chainId,
		});
		return hash;
	} catch (error) {
		throw walletError(error);
	}
}

function escrowCall(wallet: EscrowWallet) {
	return {
		abi: snapflowEscrowAbi,
		address: wallet.escrow,
		account: wallet.account,
		chainId: wallet.chainId,
	};
}

export async function usdcBalance(wallet: EscrowWallet): Promise<bigint> {
	try {
		return await readContract(wallet.config, {
			abi: erc20Abi,
			address: wallet.usdc,
			functionName: 'balanceOf',
			args: [wallet.account],
			chainId: wallet.chainId,
		});
	} catch (error) {
		throw walletError(error);
	}
}

async function usdcAllowance(wallet: EscrowWallet): Promise<bigint> {
	return readContract(wallet.config, {
		abi: erc20Abi,
		address: wallet.usdc,
		functionName: 'allowance',
		args: [wallet.account, wallet.escrow],
		chainId: wallet.chainId,
	});
}

export async function needsUsdcApproval(
	wallet: EscrowWallet,
	amount: bigint
): Promise<boolean> {
	try {
		return (await usdcAllowance(wallet)) < amount;
	} catch (error) {
		throw walletError(error);
	}
}

export function approveUsdc(
	wallet: EscrowWallet,
	amount: bigint
): Promise<Hash> {
	return confirmed(wallet, async () => {
		const { request } = await simulateContract(wallet.config, {
			abi: erc20Abi,
			address: wallet.usdc,
			functionName: 'approve',
			args: [wallet.escrow, amount],
			account: wallet.account,
			chainId: wallet.chainId,
		});
		return writeContract(wallet.config, request);
	});
}

export function depositFor(
	wallet: EscrowWallet,
	customer: Address,
	amount: bigint
): Promise<Hash> {
	return confirmed(wallet, async () => {
		const { request } = await simulateContract(wallet.config, {
			...escrowCall(wallet),
			functionName: 'depositFor',
			args: [customer, amount],
		});
		return writeContract(wallet.config, request);
	});
}

export function requestWithdrawal(
	wallet: EscrowWallet,
	amount: bigint
): Promise<Hash> {
	return confirmed(wallet, async () => {
		const { request } = await simulateContract(wallet.config, {
			...escrowCall(wallet),
			functionName: 'requestWithdrawal',
			args: [amount],
		});
		return writeContract(wallet.config, request);
	});
}

export function cancelWithdrawal(wallet: EscrowWallet): Promise<Hash> {
	return confirmed(wallet, async () => {
		const { request } = await simulateContract(wallet.config, {
			...escrowCall(wallet),
			functionName: 'cancelWithdrawal',
		});
		return writeContract(wallet.config, request);
	});
}

export function withdraw(wallet: EscrowWallet): Promise<Hash> {
	return confirmed(wallet, async () => {
		const { request } = await simulateContract(wallet.config, {
			...escrowCall(wallet),
			functionName: 'withdraw',
		});
		return writeContract(wallet.config, request);
	});
}

export function setSessionKey(
	wallet: EscrowWallet,
	grant: SessionKeyGrant
): Promise<Hash> {
	return confirmed(wallet, async () => {
		const { request } = await simulateContract(wallet.config, {
			...escrowCall(wallet),
			functionName: 'setSessionKey',
			args: [grant.key, grant.spendCap, grant.hourlyCap, grant.expiry],
		});
		return writeContract(wallet.config, request);
	});
}

export function revokeSessionKey(
	wallet: EscrowWallet,
	key: Address
): Promise<Hash> {
	return confirmed(wallet, async () => {
		const { request } = await simulateContract(wallet.config, {
			...escrowCall(wallet),
			functionName: 'revokeSessionKey',
			args: [key],
		});
		return writeContract(wallet.config, request);
	});
}
