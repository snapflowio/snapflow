/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Inject, Injectable } from '@nestjs/common';
import {
	type P256PublicKey,
	PASSKEY_SIGNER_VERIFIERS,
	type SafeCall,
	SafeOperation,
	safeAccountAddress,
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
	BaseError,
	encodeFunctionData,
	erc20Abi,
	type Hash,
	type Hex,
	hexToBigInt,
	isAddressEqual,
	type PublicClient,
	type StateOverride,
} from 'viem';
import type { Passkey } from '../../../auth/entities/passkey.entity';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../constants/settlement.constants';
import {
	USER_WALLET_SALT_NONCE,
	WALLET_RELAYER,
} from '../../constants/user-wallet.constants';
import {
	callRevertReason,
	isChainUnreachable,
} from '../../utils/chain-error.util';
import { withMargin } from '../../utils/relay/gas-cost.util';
import { storedPasskeyPublicKey } from '../../utils/wallets/passkey-public-key.util';
import { executionGas } from '../../utils/wallets/wallet-gas.util';
import type {
	PasskeySigner,
	RelayCall,
} from '../../utils/wallets/wallet-relay-call.util';

const ERC1271_MAGIC_VALUE: Hex = '0x1626ba7e';
const EMPTY_CODE = new Set<string | undefined>([undefined, '0x']);

const SAFE_GUARD_STORAGE_SLOT: Hex =
	'0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8';
const SAFE_MODULES_SENTINEL: Address =
	'0x0000000000000000000000000000000000000001';
const FIRST_MODULE_PAGE_SIZE = 1n;

const SAFE_EXTENSION_REFUSAL = {
	GUARD:
		'the Safe has a transaction guard set, which Snapflow does not relay for',
	MODULE: 'the Safe has a module enabled, which Snapflow does not relay for',
} as const;

export type RelaySimulation =
	| { failure: null; gas: { used: bigint; limit: bigint } }
	| { failure: string; gas: null };

export interface SafeWalletState {
	safeDeployed: boolean;
	signerDeployed: boolean;
	owners: readonly Address[];
	nonce: bigint;
}

function simulatedCodeSource(
	safe: Address,
	call: SafeCall,
	safeDeployed: boolean
): Address | null {
	if (call.operation === SafeOperation.DELEGATE_CALL) return call.to;
	if (!safeDeployed && isAddressEqual(call.to, safe)) return safeL2Address;
	return null;
}

@Injectable()
export class SafeWalletChainService {
	private proxyCreationCode: Promise<Hex> | undefined;
	private readonly deployedCode = new Map<Address, Promise<Hex>>();

	constructor(
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService
	) {}

	signerAddress(publicKey: P256PublicKey, verifiers: bigint): Promise<Address> {
		return this.client.readContract({
			address: safeWebAuthnSignerFactoryAddress,
			abi: safeWebAuthnSignerFactoryAbi,
			functionName: 'getSigner',
			args: [publicKey.x, publicKey.y, verifiers],
		});
	}

	async passkeySigner(
		passkey: Pick<Passkey, 'publicKey'>
	): Promise<PasskeySigner | null> {
		const publicKey = storedPasskeyPublicKey(passkey.publicKey);
		if (!publicKey) return null;
		const verifiers = PASSKEY_SIGNER_VERIFIERS;
		const address = await this.signerAddress(publicKey, verifiers);
		return { address, publicKey, verifiers };
	}

	async safeAddress(owner: Address): Promise<Address> {
		return safeAccountAddress({
			proxyCreationCode: await this.creationCode(),
			initializer: safeSetupInitializer([owner]),
			saltNonce: USER_WALLET_SALT_NONCE,
		});
	}

	async deployed(address: Address): Promise<boolean> {
		return !EMPTY_CODE.has(await this.client.getCode({ address }));
	}

	async state(
		safe: Address,
		owner: Address,
		signer: Address
	): Promise<SafeWalletState> {
		const [safeDeployed, signerDeployed] = await Promise.all([
			this.deployed(safe),
			this.deployed(signer),
		]);
		if (!safeDeployed) {
			return { safeDeployed, signerDeployed, owners: [owner], nonce: 0n };
		}
		const contract = { address: safe, abi: safeL2Abi } as const;
		const [owners, nonce] = await Promise.all([
			this.client.readContract({ ...contract, functionName: 'getOwners' }),
			this.client.readContract({ ...contract, functionName: 'nonce' }),
		]);
		return { safeDeployed, signerDeployed, owners, nonce };
	}

	async signatureValid(
		safeTxHash: Hash,
		signature: Hex,
		signer: PasskeySigner
	): Promise<boolean> {
		const magic = await this.client.readContract({
			address: safeWebAuthnSignerFactoryAddress,
			abi: safeWebAuthnSignerFactoryAbi,
			functionName: 'isValidSignatureForSigner',
			args: [
				safeTxHash,
				signature,
				signer.publicKey.x,
				signer.publicKey.y,
				signer.verifiers,
			],
		});
		return magic === ERC1271_MAGIC_VALUE;
	}

	async simulateRelay(
		safe: Address,
		call: RelayCall
	): Promise<RelaySimulation> {
		const extension = await this.extension(safe);
		if (extension !== null) return { failure: extension, gas: null };
		let estimate: bigint;
		try {
			estimate = await this.estimateRelayerGas(call);
		} catch (error) {
			if (!(error instanceof BaseError) || isChainUnreachable(error)) {
				throw error;
			}
			return { failure: callRevertReason(error, safeL2Abi), gas: null };
		}
		const gasLimit = withMargin(
			estimate,
			WALLET_RELAYER.GAS_LIMIT_MARGIN_BASIS_POINTS
		);
		const fees = await this.client.estimateFeesPerGas();
		const [block] = await this.client.simulateBlocks({
			validation: true,
			blocks: [
				{
					calls: [
						{
							account: this.config.get('settlement.relayerAddress'),
							to: call.to,
							data: call.data,
							gas: gasLimit,
							maxFeePerGas: fees.maxFeePerGas,
							maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
						},
					],
				},
			],
		});
		const result = block?.calls[0];
		if (!result) throw new Error('The chain simulated no call');
		return result.status === 'success'
			? { failure: null, gas: { used: result.gasUsed, limit: gasLimit } }
			: { failure: callRevertReason(result.error, safeL2Abi), gas: null };
	}

	private async extension(safe: Address): Promise<string | null> {
		if (!(await this.deployed(safe))) return null;
		const [guard, [modules]] = await Promise.all([
			this.client.getStorageAt({
				address: safe,
				slot: SAFE_GUARD_STORAGE_SLOT,
			}),
			this.client.readContract({
				address: safe,
				abi: safeL2Abi,
				functionName: 'getModulesPaginated',
				args: [SAFE_MODULES_SENTINEL, FIRST_MODULE_PAGE_SIZE],
			}),
		]);
		if (guard !== undefined && hexToBigInt(guard) !== 0n) {
			return SAFE_EXTENSION_REFUSAL.GUARD;
		}
		if (modules.length > 0) return SAFE_EXTENSION_REFUSAL.MODULE;
		return null;
	}

	estimateRelayerGas(call: RelayCall): Promise<bigint> {
		return this.client.estimateGas({
			account: this.config.get('settlement.relayerAddress'),
			to: call.to,
			data: call.data,
		});
	}

	async estimateCallGas(
		safe: Address,
		call: SafeCall,
		safeDeployed: boolean
	): Promise<bigint> {
		const delegated = call.operation === SafeOperation.DELEGATE_CALL;
		const runsAs = simulatedCodeSource(safe, call, safeDeployed);
		const stateOverride: StateOverride | undefined = runsAs
			? [{ address: safe, code: await this.code(runsAs) }]
			: undefined;
		return this.client.estimateGas({
			account: safe,
			to: delegated ? safe : call.to,
			data: call.data,
			stateOverride,
		});
	}

	async usdcTransferExecutionGas(
		safe: Address,
		recipient: Address,
		amount: bigint
	): Promise<bigint> {
		const data = encodeFunctionData({
			abi: erc20Abi,
			functionName: 'transfer',
			args: [recipient, amount],
		});
		const estimate = await this.client.estimateGas({
			account: safe,
			to: this.config.get('settlement.usdcAddress'),
			data,
		});
		return executionGas(estimate, data);
	}

	usdcBalance(owner: Address): Promise<bigint> {
		return this.client.readContract({
			address: this.config.get('settlement.usdcAddress'),
			abi: erc20Abi,
			functionName: 'balanceOf',
			args: [owner],
		});
	}

	private code(address: Address): Promise<Hex> {
		let code = this.deployedCode.get(address);
		if (!code) {
			code = this.client.getCode({ address }).then((found) => {
				if (found === undefined || EMPTY_CODE.has(found)) {
					throw new Error(`The chain has no contract at ${address}`);
				}
				return found;
			});
			code.catch(() => this.deployedCode.delete(address));
			this.deployedCode.set(address, code);
		}
		return code;
	}

	private creationCode(): Promise<Hex> {
		this.proxyCreationCode ??= this.client
			.readContract({
				address: safeProxyFactoryAddress,
				abi: safeProxyFactoryAbi,
				functionName: 'proxyCreationCode',
			})
			.catch((error: unknown) => {
				this.proxyCreationCode = undefined;
				throw error;
			});
		return this.proxyCreationCode;
	}
}
