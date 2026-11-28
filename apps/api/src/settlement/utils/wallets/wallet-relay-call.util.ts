/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	encodeMultiSend,
	type MultiSendCall,
	multiSendCallOnlyAddress,
	type P256PublicKey,
	type SafeTransaction,
	safeL2Abi,
	safeL2Address,
	safeProxyFactoryAbi,
	safeProxyFactoryAddress,
	safeSetupInitializer,
	safeWebAuthnSignerFactoryAbi,
	safeWebAuthnSignerFactoryAddress,
} from '@snapflow/contracts';
import {
	type Address,
	encodeFunctionData,
	type Hex,
	hexToBigInt,
	numberToHex,
} from 'viem';
import { USER_WALLET_SALT_NONCE } from '../../constants/user-wallet.constants';
import type { UserWallet } from '../../entities/user-wallet.entity';
import type { WalletTransaction } from '../../entities/wallet-transaction.entity';

export interface PasskeySigner {
	address: Address;
	publicKey: P256PublicKey;
	verifiers: bigint;
}

type StoredSignerKey = Pick<
	UserWallet,
	'publicKeyX' | 'publicKeyY' | 'verifiers'
>;

type TransactionSigner = Pick<
	WalletTransaction,
	'signerAddress' | 'signerPublicKeyX' | 'signerPublicKeyY' | 'signerVerifiers'
>;

const COORDINATE_BYTES = 32;

export function storedSignerKey(signer: PasskeySigner): StoredSignerKey {
	return {
		publicKeyX: numberToHex(signer.publicKey.x, { size: COORDINATE_BYTES }),
		publicKeyY: numberToHex(signer.publicKey.y, { size: COORDINATE_BYTES }),
		verifiers: numberToHex(signer.verifiers),
	};
}

export function transactionSignerColumns(
	signer: PasskeySigner
): TransactionSigner {
	const key = storedSignerKey(signer);
	return {
		signerAddress: signer.address,
		signerPublicKeyX: key.publicKeyX,
		signerPublicKeyY: key.publicKeyY,
		signerVerifiers: key.verifiers,
	};
}

export function transactionSigner(columns: TransactionSigner): PasskeySigner {
	return {
		address: columns.signerAddress,
		publicKey: {
			x: hexToBigInt(columns.signerPublicKeyX),
			y: hexToBigInt(columns.signerPublicKeyY),
		},
		verifiers: hexToBigInt(columns.signerVerifiers),
	};
}

export function walletSigner(
	wallet: Pick<
		UserWallet,
		'signerAddress' | 'publicKeyX' | 'publicKeyY' | 'verifiers'
	>
): PasskeySigner {
	return transactionSigner({
		signerAddress: wallet.signerAddress,
		signerPublicKeyX: wallet.publicKeyX,
		signerPublicKeyY: wallet.publicKeyY,
		signerVerifiers: wallet.verifiers,
	});
}

type WalletDeployment = Pick<
	WalletRelay,
	'owner' | 'signer' | 'deploySigner' | 'deploySafe'
>;

interface WalletRelay {
	safe: Address;
	owner: Address;
	signer: PasskeySigner;
	transaction: SafeTransaction;
	signatures: Hex;
	deploySigner: boolean;
	deploySafe: boolean;
}

export interface RelayCall {
	to: Address;
	data: Hex;
}

function execTransaction({ transaction, signatures }: WalletRelay): Hex {
	return encodeFunctionData({
		abi: safeL2Abi,
		functionName: 'execTransaction',
		args: [
			transaction.to,
			transaction.value,
			transaction.data,
			transaction.operation,
			transaction.safeTxGas,
			transaction.baseGas,
			transaction.gasPrice,
			transaction.gasToken,
			transaction.refundReceiver,
			signatures,
		],
	});
}

export function walletDeploymentCalls(
	relay: WalletDeployment
): Omit<MultiSendCall, 'operation'>[] {
	const { publicKey, verifiers } = relay.signer;
	return [
		...(relay.deploySigner
			? [
					{
						to: safeWebAuthnSignerFactoryAddress,
						value: 0n,
						data: encodeFunctionData({
							abi: safeWebAuthnSignerFactoryAbi,
							functionName: 'createSigner',
							args: [publicKey.x, publicKey.y, verifiers],
						}),
					},
				]
			: []),
		...(relay.deploySafe
			? [
					{
						to: safeProxyFactoryAddress,
						value: 0n,
						data: encodeFunctionData({
							abi: safeProxyFactoryAbi,
							functionName: 'createProxyWithNonce',
							args: [
								safeL2Address,
								safeSetupInitializer([relay.owner]),
								USER_WALLET_SALT_NONCE,
							],
						}),
					},
				]
			: []),
	];
}

export function walletRelayCall(relay: WalletRelay): RelayCall {
	const execute = { to: relay.safe, value: 0n, data: execTransaction(relay) };
	const deployments = walletDeploymentCalls(relay);
	if (deployments.length === 0) {
		return { to: execute.to, data: execute.data };
	}
	return {
		to: multiSendCallOnlyAddress,
		data: encodeMultiSend([...deployments, execute]),
	};
}

export function nextSafeNonce(
	chainNonce: bigint,
	openNonces: readonly bigint[]
): bigint {
	return openNonces.reduce(
		(next, nonce) => (nonce >= next ? nonce + 1n : next),
		chainNonce
	);
}
