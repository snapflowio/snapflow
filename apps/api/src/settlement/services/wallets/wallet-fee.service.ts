/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import {
	encodeMultiSend,
	feePaidSafeCall,
	multiSendCallOnlyAddress,
	relayedSafeTransaction,
	type SafeCall,
	safeCallBatch,
	snapflowEscrowAbi,
	type WalletFeePayee,
	walletFeeBatch,
} from '@snapflow/contracts';
import { BaseError } from 'viem';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { SettingsService } from '../../../settings/services/settings.service';
import {
	UserWalletErrorCode,
	WALLET_GAS,
} from '../../constants/user-wallet.constants';
import type { UserWallet } from '../../entities/user-wallet.entity';
import {
	callRevertReason,
	isChainUnreachable,
} from '../../utils/chain-error.util';
import { gasCostMicroUsd } from '../../utils/relay/gas-cost.util';
import type { WalletCallRefusal } from '../../utils/wallets/wallet-call-policy.util';
import {
	calldataGas,
	executionGas,
	PLACEHOLDER_SAFE_SIGNATURES,
	walletFeeCapMicroUsd,
} from '../../utils/wallets/wallet-gas.util';
import {
	type RelayCall,
	walletDeploymentCalls,
	walletRelayCall,
	walletSigner,
} from '../../utils/wallets/wallet-relay-call.util';
import { walletUsdcOutflow } from '../../utils/wallets/wallet-usdc-outflow.util';
import { RelayFeeQuoteService } from '../relay/relay-fee-quote.service';
import {
	SafeWalletChainService,
	type SafeWalletState,
} from './safe-wallet-chain.service';

interface WalletFeeQuote {
	call: SafeCall;
	feeMicroUsd: bigint;
}

export type WalletFeeQuoteResult =
	| { quote: WalletFeeQuote; refusal: null }
	| { quote: null; refusal: WalletCallRefusal };

export type WalletRepayment =
	| { gasLimit: bigint; refusal: null }
	| { gasLimit: null; refusal: WalletCallRefusal };

function unpaid(code: UserWalletErrorCode, message: string): WalletRepayment {
	return { gasLimit: null, refusal: { code, message } };
}

function refused(
	code: UserWalletErrorCode,
	message: string
): { quote: null; refusal: WalletCallRefusal } {
	return { quote: null, refusal: { code, message } };
}

@Injectable()
export class WalletFeeService {
	constructor(
		private readonly chain: SafeWalletChainService,
		private readonly fees: RelayFeeQuoteService,
		private readonly settings: SettingsService,
		private readonly config: TypedConfigService
	) {}

	payee(): WalletFeePayee {
		return {
			usdc: this.config.get('settlement.usdcAddress'),
			relayer: this.config.get('settlement.relayerAddress'),
		};
	}

	async quote(
		wallet: UserWallet,
		call: SafeCall,
		state: SafeWalletState,
		nonce: bigint
	): Promise<WalletFeeQuoteResult> {
		const safe = wallet.safeAddress;
		const payee = this.payee();
		const balance = await this.chain.usdcBalance(safe);
		const outflow = this.outflow(call);
		if (balance <= outflow) {
			return refused(
				UserWalletErrorCode.INSUFFICIENT_FUNDS,
				`The wallet holds ${balance} USDC base units; the transaction moves ${outflow} and its fee needs more`
			);
		}
		let callGas: bigint;
		try {
			callGas = executionGas(
				await this.chain.estimateCallGas(safe, call, state.safeDeployed),
				call.data
			);
		} catch (error) {
			if (!(error instanceof BaseError) || isChainUnreachable(error)) {
				throw error;
			}
			return refused(
				UserWalletErrorCode.SIMULATION_FAILED,
				`The transaction would fail: ${callRevertReason(error, snapflowEscrowAbi)}`
			);
		}
		const calls = safeCallBatch(call);
		const spare = balance - outflow;
		const deployment = {
			owner: wallet.signerAddress,
			signer: walletSigner(wallet),
			deploySigner: !state.signerDeployed,
			deploySafe: !state.safeDeployed,
		};
		const [deploymentGas, feeTransferGas] = await Promise.all([
			this.deploymentGas(deployment),
			this.chain.usdcTransferExecutionGas(safe, payee.relayer, spare),
		]);
		const placeholder = walletRelayCall({
			...deployment,
			safe,
			transaction: relayedSafeTransaction(
				feePaidSafeCall(calls, payee, spare),
				nonce
			),
			signatures: PLACEHOLDER_SAFE_SIGNATURES,
		});
		const gas =
			WALLET_GAS.TRANSACTION +
			calldataGas(placeholder.data) +
			deploymentGas +
			WALLET_GAS.SAFE_EXECUTION +
			callGas +
			feeTransferGas;
		const pricing = await this.fees.transactionPricing({
			account: payee.relayer,
			...placeholder,
			gas,
		});
		const feeMicroUsd = this.fees.cost(gas, pricing);
		if (feeMicroUsd > spare) {
			return refused(
				UserWalletErrorCode.INSUFFICIENT_FUNDS,
				`The wallet holds ${balance} USDC base units; the transaction and its fee need ${outflow + feeMicroUsd}`
			);
		}
		return {
			quote: { call: feePaidSafeCall(calls, payee, feeMicroUsd), feeMicroUsd },
			refusal: null,
		};
	}

	async refusal(
		wallet: Pick<UserWallet, 'safeAddress'>,
		call: SafeCall,
		relay: RelayCall
	): Promise<WalletCallRefusal | null> {
		return (await this.repayment(wallet, call, relay)).refusal;
	}

	async repayment(
		wallet: Pick<UserWallet, 'safeAddress'>,
		call: SafeCall,
		relay: RelayCall
	): Promise<WalletRepayment> {
		const payee = this.payee();
		const batch = walletFeeBatch(call, payee);
		if (!batch) {
			return unpaid(
				UserWalletErrorCode.FEE_INVALID,
				"The transaction does not end in its USDC fee to Snapflow's relayer; prepare it again"
			);
		}
		const required = this.outflow(call);
		const balance = await this.chain.usdcBalance(wallet.safeAddress);
		if (balance < required) {
			return unpaid(
				UserWalletErrorCode.INSUFFICIENT_FUNDS,
				`The wallet holds ${balance} USDC base units; the transaction and its fee need ${required}`
			);
		}
		const simulation = await this.chain.simulateRelay(
			wallet.safeAddress,
			relay
		);
		if (simulation.failure !== null) {
			return unpaid(
				UserWalletErrorCode.SIMULATION_FAILED,
				`The transaction would fail: ${simulation.failure}`
			);
		}
		const [pricing, settings] = await Promise.all([
			this.fees.transactionPricing({
				account: payee.relayer,
				...relay,
				gas: simulation.gas.used,
			}),
			this.settings.get(),
		]);
		const cost = gasCostMicroUsd(simulation.gas.used, pricing);
		if (batch.feeMicroUsd < cost) {
			return unpaid(
				UserWalletErrorCode.FEE_TOO_LOW,
				`The fee of ${batch.feeMicroUsd} USDC base units no longer covers the ${cost} its gas costs now; prepare the transaction again`
			);
		}
		const cap = walletFeeCapMicroUsd(
			simulation.gas.limit,
			pricing,
			settings.walletFeeCapBasisPoints
		);
		if (batch.feeMicroUsd > cap) {
			return unpaid(
				UserWalletErrorCode.FEE_ABOVE_CAP,
				`The fee of ${batch.feeMicroUsd} USDC base units is above the ${cap} the relayer accepts for its gas now; prepare the transaction again`
			);
		}
		return { gasLimit: simulation.gas.limit, refusal: null };
	}

	private async deploymentGas(
		deployment: Parameters<typeof walletDeploymentCalls>[0]
	): Promise<bigint> {
		const calls = walletDeploymentCalls(deployment);
		if (calls.length === 0) return 0n;
		const data = encodeMultiSend(calls);
		return executionGas(
			await this.chain.estimateRelayerGas({
				to: multiSendCallOnlyAddress,
				data,
			}),
			data
		);
	}

	private outflow(call: SafeCall): bigint {
		return walletUsdcOutflow(call, {
			usdc: this.config.get('settlement.usdcAddress'),
			escrow: this.config.get('settlement.escrowAddress'),
		});
	}
}
