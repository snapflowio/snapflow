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
	EscrowAccount,
	Location,
	MoveSandbox,
	PaymentVoucher,
	SandboxLease,
	SandboxPlacementAlternative,
	SandboxQuote,
	VoucherDelegation,
} from '@snapflow/api-client';
export {
	Continent,
	GpuType,
	LeaseRenewalState,
	MachineCategory,
	MachineTier,
	MachineUnavailableReason,
	PlacementKind,
	SandboxCapability,
	SandboxClass,
	SandboxListSortDirection,
	SandboxListSortField,
	SandboxMode,
	SandboxState,
	VoucherSigningMode,
	WhenMachineUnavailable,
} from '@snapflow/api-client';
export type {
	FileInfo,
	GitStatus,
	ListBranchResponse,
	Match,
	ReplaceResult,
	SearchFilesResponse,
} from '@snapflow/toolbox-api-client';
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
export {
	SandboxPlacementErrorCode,
	SnapflowLeaseRenewalRequiredError,
	SnapflowMachineUnavailableError,
	SnapflowPriceChangedError,
} from './errors/sandbox-placement-error.js';
export {
	SnapflowEscrowError,
	SnapflowVoucherRejectedError,
	VoucherRejectionReason,
} from './errors/settlement-error.js';
export {
	SnapflowAuthenticationError,
	SnapflowAuthorizationError,
	SnapflowConflictError,
	SnapflowConnectionError,
	SnapflowError,
	SnapflowNotFoundError,
	SnapflowRateLimitError,
	SnapflowTimeoutError,
	SnapflowValidationError,
} from './errors/snapflow-error.js';
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
export { Git } from './git.js';
export { Image } from './image.js';
export { LspLanguageId } from './lsp-server.js';
export { Process } from './process.js';
export * from './process.types.js';
export * from './pty-handle.js';
export { Sandbox } from './sandbox.js';
export type {
	ListSandboxesQuery,
	StartSandboxOptions,
} from './sandbox.types.js';
export type {
	DepositOptions,
	EscrowBalance,
	EscrowClients,
	EscrowOptions,
	EscrowWithdrawal,
	SessionKeyLimits,
} from './settlement/escrow.js';
export { Escrow } from './settlement/escrow.js';
export { PERMIT_LIFETIME_SECONDS } from './settlement/escrow-permit.js';
export type {
	EscrowPublicClient,
	EscrowWalletClient,
} from './settlement/escrow-transaction.js';
export type {
	GeneratedSessionKey,
	SessionKeySource,
} from './settlement/session-key.js';
export {
	generateSessionKey,
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
export { SettlementService } from './settlement.js';
export { Snapflow } from './snapflow.js';
export type {
	CountryCode,
	CreateSandboxBaseParams,
	CreateSandboxFromImageParams,
	CreateSandboxFromSnapshotParams,
	FlexiblePlacement,
	LocationCode,
	PinnedPlacement,
	Placement,
	QuoteSandboxParams,
	Resources,
	SnapflowConfig,
	VolumeMount,
} from './snapflow.types.js';
export { CodeLanguage } from './snapflow.types.js';
export type {
	CreateSnapshotOptions,
	CreateSnapshotParams,
} from './snapshot.js';
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
export * from './types/pty.js';
export type { IdempotentOperationOptions } from './utils/idempotency.js';
