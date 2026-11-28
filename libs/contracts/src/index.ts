/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export {
	DEPOSIT_AUTHORIZATION_TAG,
	type DepositAuthorization,
	depositNonceOf,
} from './deposit.js';
export {
	ESCROW_DOMAIN_NAME,
	ESCROW_DOMAIN_VERSION,
	type EscrowDomain,
	escrowDomain,
} from './domain.js';
export type {
	ClaimItem,
	ClaimsFreeze,
	EscrowAccount,
	SignerGrant,
	SignerScope,
} from './escrow-types.js';
export {
	compatibilityFallbackHandlerAddress,
	daimoP256VerifierAddress,
	multiSendCallOnlyAbi,
	multiSendCallOnlyAddress,
	safeL2Abi,
	safeL2Address,
	safeProxyFactoryAbi,
	safeProxyFactoryAddress,
	safeWebAuthnSignerFactoryAbi,
	safeWebAuthnSignerFactoryAddress,
} from './generated/safe.abi.js';
export { snapflowEscrowAbi } from './generated/snapflow-escrow.abi.js';
export {
	type HostWithdrawal,
	hashHostWithdrawal,
	hostWithdrawalTypedData,
	hostWithdrawalTypes,
	recoverHostWithdrawalSigner,
} from './host-withdrawal.js';
export {
	BATCH_ITEM_GAS,
	BPS_DENOMINATOR,
	batchItemsGas,
	feeBpsForMarkup,
	feeOf,
	MAX_BATCH_SIZE,
	MAX_BLOCK_DURATION,
	MAX_FEE_BPS,
	MAX_RELAY_FEE,
	MIN_AUTO_TOP_UP_INTERVAL,
	SECONDS_PER_HOUR,
	SIGNER_BURST_HOURS,
} from './limits.js';
export {
	hashPayoutAddress,
	type PayoutAddress,
	payoutAddressTypedData,
	payoutAddressTypes,
	recoverPayoutAddressSigner,
} from './payout-address.js';
export {
	addOwnerCall,
	P256_PRECOMPILE_ADDRESS,
	type P256PublicKey,
	PASSKEY_SIGNER_VERIFIERS,
	SAFE_OWNER_THRESHOLD,
	type SafeAccountDeployment,
	safeAccountAddress,
	safeSetupInitializer,
} from './safe-account.js';
export {
	decodeMultiSendTransactions,
	encodeMultiSend,
	hashSafeTransaction,
	isSafeOperation,
	type MultiSendCall,
	relayedSafeTransaction,
	SAFE_OPERATIONS,
	type SafeCall,
	SafeOperation,
	type SafeOperationCall,
	type SafeTransaction,
	safeTransactionTypedData,
	safeTransactionTypes,
} from './safe-transaction.js';
export {
	assertEscrowSignature,
	InvalidEscrowSignatureError,
} from './signature.js';
export {
	refillSignerBudget,
	type SignerBudget,
	signerAvailableAt,
	signerBudgetCapacity,
} from './signer-budget.js';
export {
	hashSignerProof,
	recoverSignerProofSigner,
	SIGNER_PROOF_TAG,
	signerProofMessage,
} from './signer-proof.js';
export {
	type ChannelTerms,
	channelIdOf,
	hashVoucher,
	recoverVoucherSigner,
	type Voucher,
	voucherTypedData,
	voucherTypes,
} from './voucher.js';
export {
	type BatchedCall,
	batchedSafeCall,
	feePaidSafeCall,
	safeCallBatch,
	type WalletFeeBatch,
	type WalletFeePayee,
	walletFeeBatch,
	walletFeeTransfer,
} from './wallet-fee.js';
export {
	decodeWebAuthnSignature,
	encodeWebAuthnSignature,
	safeContractSignature,
	type WebAuthnAssertion,
} from './webauthn-signature.js';
