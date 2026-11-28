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

export type {
	ApiError,
	ApiKeyBudget,
	AutoTopUp,
	CustomDomainDto,
	EscrowAccount,
	HostEscrowBalance,
	Location,
	MoveSandbox,
	PaymentChannel,
	PaymentChannelPage,
	PaymentVoucher,
	PaymentWallet,
	RecoveryOwner,
	SandboxPlacementAlternative,
	SandboxPrice,
	SandboxQuote,
	SiweNonce,
	UpdateApiKeyBudget,
	UpdateAutoTopUp,
	UserWallet,
	VoucherDelegation,
	WalletTransaction,
} from '@snapflow/api-client';
export {
	ApiErrorCode,
	AutoTopUpStatus,
	Continent,
	GpuType,
	MachineCategory,
	MachineTier,
	MachineUnavailableReason,
	PaymentChannelKind,
	PaymentWalletPurpose,
	PlacementKind,
	RecoveryOwnerKind,
	RecoveryStatus,
	SandboxCapability,
	SandboxClass,
	SandboxListSortDirection,
	SandboxListSortField,
	SandboxMode,
	SandboxPlacementErrorCode,
	SandboxState,
	VoucherLimit,
	VoucherSigningMode,
	WalletTransactionStatus,
	WhenMachineUnavailable,
} from '@snapflow/api-client';
export type { ChannelTerms, WebAuthnAssertion } from '@snapflow/contracts';
export { channelIdOf } from '@snapflow/contracts';
export type {
	FileInfo,
	GitStatus,
	ListBranchResponse,
	Match,
	ReplaceResult,
	SearchFilesResponse,
} from '@snapflow/toolbox-api-client';
export { BudgetService } from './budget.js';
export { CodeInterpreter } from './code-interpreter.js';
export type {
	AccessibilityFindOptions,
	AccessibilityTreeOptions,
} from './computer-use/accessibility.js';
export { Accessibility } from './computer-use/accessibility.js';
export { Display } from './computer-use/display.js';
export { Keyboard } from './computer-use/keyboard.js';
export { Mouse } from './computer-use/mouse.js';
export type {
	ScreenshotOptions,
	ScreenshotRegion,
} from './computer-use/screenshot.js';
export { Screenshot } from './computer-use/screenshot.js';
export { ComputerUse } from './computer-use.js';
export type { DesktopLink, DesktopLinkOptions } from './desktop-link.js';
export type { SnapflowErrorCode } from './errors/error-catalog.js';
export { SdkErrorCode } from './errors/error-catalog.js';
export {
	SnapflowMachineUnavailableError,
	SnapflowPriceAboveMaximumError,
	SnapflowPriceChangedError,
} from './errors/sandbox-placement-error.js';
export {
	SnapflowEscrowError,
	SnapflowVoucherRejectedError,
	VoucherRejectionReason,
} from './errors/settlement-error.js';
export type {
	ResponseHeaders,
	SnapflowErrorOptions,
} from './errors/snapflow-error.js';
export {
	SnapflowAuthenticationError,
	SnapflowAuthorizationError,
	SnapflowConflictError,
	SnapflowConnectionError,
	SnapflowError,
	SnapflowNotFoundError,
	SnapflowRateLimitError,
	SnapflowSandboxTimeoutError,
	SnapflowTimeoutError,
	SnapflowValidationError,
} from './errors/snapflow-error.js';
export {
	SnapflowWalletCancelledError,
	SnapflowWalletError,
} from './errors/wallet-error.js';
export { FileSystem } from './file-system.js';
export type {
	DownloadMetadata,
	DownloadProgress,
	DownloadStreamOptions,
	FileDownloadErrorDetails,
	FileDownloadRequest,
	FileDownloadResponse,
	FilePermissionsParams,
	FileUpload,
	UploadProgress,
	UploadSource,
	UploadStreamOptions,
} from './file-system.types.js';
export type { GitCommitResponse } from './git.js';
export { Git } from './git.js';
export { Image } from './image.js';
export type {
	Context as ImageContext,
	PipInstallOptions,
	PyprojectOptions,
} from './image.types.js';
export type { Position as LspPosition } from './lsp-server.js';
export { LspLanguageId, LspServer } from './lsp-server.js';
export { Process } from './process.js';
export * from './process.types.js';
export * from './pty-handle.js';
export { Sandbox } from './sandbox.js';
export type {
	ListSandboxesQuery,
	StartSandboxOptions,
} from './sandbox.types.js';
export type { SignedDepositAuthorization } from './settlement/deposit-authorization.js';
export { DEPOSIT_AUTHORIZATION_LIFETIME_SECONDS } from './settlement/deposit-authorization.js';
export type {
	AutoTopUpFrequency,
	AutoTopUpLimits,
	AutoTopUpSetup,
	AutoTopUpTerms,
	DepositAuthorizationOptions,
	DepositOptions,
	EscrowContracts,
	EscrowOptions,
	EscrowSetup,
} from './settlement/escrow.js';
export { autoTopUpInterval, Escrow } from './settlement/escrow.js';
export { PERMIT_LIFETIME_SECONDS } from './settlement/escrow-permit.js';
export type {
	EscrowClients,
	EscrowExecutor,
	EscrowExecutorClients,
	EscrowPublicClient,
	EscrowStep,
	EscrowWalletClient,
} from './settlement/escrow-transaction.js';
export { walletExecutor } from './settlement/escrow-transaction.js';
export type {
	AutoTopUpState,
	EscrowAccountState,
	EscrowAutoTopUpLimits,
	SignerAuthorization,
	SignerGrant,
	SignerLimitRaise,
	SignerScope,
} from './settlement/escrow-types.js';
export type {
	GeneratedSessionKey,
	SessionKeySource,
} from './settlement/session-key.js';
export {
	generateSessionKey,
	SIGNER_PROOF_LIFETIME_SECONDS,
	sessionKeyAuthorization,
	toSessionKeyAccount,
} from './settlement/session-key.js';
export type { VoucherSpendPolicy } from './settlement/spend-policy.js';
export { SPEND_RATE_TOLERANCE_MILLISECONDS } from './settlement/spend-policy.js';
export type { VoucherSignerOptions } from './settlement/voucher-signer.js';
export {
	CHANNEL_RETENTION_MILLISECONDS,
	DEFAULT_VOUCHER_POLL_INTERVAL_MILLISECONDS,
	VoucherSigner,
} from './settlement/voucher-signer.js';
export { VOUCHER_CLOCK_SKEW_SECONDS } from './settlement/voucher-verification.js';
export type {
	AutoTopUpOptions,
	DelegatedPaymentsSetup,
	PaymentChannelQuery,
} from './settlement.js';
export { SettlementService } from './settlement.js';
export type { CreateSandboxParams } from './snapflow/create-sandbox-request.js';
export { DEFAULT_SANDBOX_MODE } from './snapflow/create-sandbox-request.js';
export { Snapflow } from './snapflow.js';
export type {
	CountryCode,
	CreateSandboxBaseParams,
	CreateSandboxFromImageParams,
	CreateSandboxFromSnapshotParams,
	CreateSandboxOptions,
	FlexiblePlacement,
	LocationCode,
	PinnedPlacement,
	Placement,
	QuoteSandboxParams,
	Resources,
	SnapflowConfig,
	SnapshotBuildResources,
	SnapshotResources,
	VolumeMount,
} from './snapflow.types.js';
export { CodeLanguage } from './snapflow.types.js';
export type {
	CreateSnapshotOptions,
	CreateSnapshotParams,
	Snapshot,
	SnapshotPage,
} from './snapshot.js';
export { SnapshotService } from './snapshot.js';
export type {
	BarChart,
	BarData,
	BoxAndWhiskerChart,
	BoxAndWhiskerData,
	Chart,
	Chart2D,
	ChartElement,
	CompositeChart,
	LineChart,
	PieChart,
	PieData,
	PointChart,
	PointData,
	ScatterChart,
} from './types/charts.js';
export { ChartType } from './types/charts.js';
export type {
	ExecutionError,
	ExecutionResult,
	OutputMessage,
	RunCodeOptions,
} from './types/code-interpreter.js';
export type { ExecuteResponse } from './types/execute-response.js';
export * from './types/pty.js';
export type { IdempotentOperationOptions } from './utils/idempotency.js';
export { DEFAULT_SANDBOX_TIMEOUT_SECONDS } from './utils/timeout.js';
export type { Volume, VolumePage } from './volume.js';
export { VolumeService } from './volume.js';
export type {
	BrowserPasskeySignerOptions,
	PasskeyAssertion,
	PasskeyRequestOptions,
	PasskeySignature,
	PasskeySigner,
} from './wallet/passkey-signer.js';
export {
	browserPasskeySigner,
	passkeySignature,
	signWithPasskey,
	webAuthnAssertionOf,
} from './wallet/passkey-signer.js';
export type { SiweSigner } from './wallet/payment-wallet-service.js';
export {
	PaymentWalletService,
	siweLinkMessage,
} from './wallet/payment-wallet-service.js';
export type { RecoveryPhrase } from './wallet/recovery-phrase.js';
export {
	generateRecoveryPhrase,
	RECOVERY_PHRASE_WORDS,
	recoveryPhraseAccount,
} from './wallet/recovery-phrase.js';
export type {
	SafeExecutorOptions,
	SafeRelay,
} from './wallet/safe-executor.js';
export { safeExecutor } from './wallet/safe-executor.js';
export type {
	ContractCall,
	SafeTarget,
	VerifiedWalletTransaction,
	WalletFeeLimits,
} from './wallet/wallet-call.js';
export { safeCallOf, usdcTransfer } from './wallet/wallet-call.js';
export type {
	EscrowExecutorOptions,
	PreparedRecoveryOwner,
	PreparedWalletCall,
	RecoveryOwnerOptions,
	WalletExecuteOptions,
	WalletFeeConfirmation,
	WalletSubmitOptions,
	WalletTransactionWaitOptions,
} from './wallet/wallet-service.js';
export {
	DEFAULT_WALLET_POLL_INTERVAL_MILLISECONDS,
	DEFAULT_WALLET_TRANSACTION_TIMEOUT_SECONDS,
	WalletService,
} from './wallet/wallet-service.js';
