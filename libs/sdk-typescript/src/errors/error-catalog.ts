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

import { ApiErrorCode } from '@snapflow/api-client';

export const SdkErrorCode = {
	CONFIGURATION_MISSING: 'sdk_configuration_missing',
	CONFIGURATION_INVALID: 'sdk_configuration_invalid',
	CONNECTION_FAILED: 'sdk_connection_failed',
	REQUEST_TIMEOUT: 'sdk_request_timeout',
	SANDBOX_STATE_TIMEOUT: 'sdk_sandbox_state_timeout',
	SANDBOX_FAILED: 'sdk_sandbox_failed',
	SNAPSHOT_FAILED: 'sdk_snapshot_failed',
	RESOURCES_INVALID: 'sdk_resources_invalid',
} as const;

export type SdkErrorCode = (typeof SdkErrorCode)[keyof typeof SdkErrorCode];

export type SnapflowErrorCode = ApiErrorCode | SdkErrorCode;

export const HttpStatus = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	PAYMENT_REQUIRED: 402,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	REQUEST_TIMEOUT: 408,
	CONFLICT: 409,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_SERVER_ERROR: 500,
} as const;

const RETRY_LATER_NEXT_STEP =
	'Retry after a short delay. If it keeps failing, contact support@snapflow.io with the request time.';
const UNAUTHORIZED_NEXT_STEP =
	'Check that the API key is valid and not revoked, then set SNAPFLOW_API_KEY or pass { apiKey }.';
const ADD_FUNDS_NEXT_STEP =
	'Add funds to the escrow on the Funding page of the dashboard, then retry.';
const RATE_LIMITED_NEXT_STEP = 'Back off and retry after a short delay.';

const NEXT_STEPS: Readonly<Partial<Record<SnapflowErrorCode, string>>> = {
	[SdkErrorCode.CONFIGURATION_MISSING]:
		'Set the SNAPFLOW_API_KEY environment variable or pass { apiKey } to new Snapflow(). Create a key in the dashboard under Settings > API keys.',
	[SdkErrorCode.CONFIGURATION_INVALID]:
		'Set SNAPFLOW_API_URL or { apiUrl } to an absolute URL such as https://snapflow.io/api, or leave it unset to use the default.',
	[SdkErrorCode.CONNECTION_FAILED]:
		'Check the network connection and SNAPFLOW_API_URL, then retry.',
	[SdkErrorCode.REQUEST_TIMEOUT]: 'Retry, or pass a larger timeout.',
	[SdkErrorCode.SANDBOX_STATE_TIMEOUT]:
		'Pass a larger timeout, or call sandbox.refreshData() later and check sandbox.state, sandbox.errorReason and sandbox.stopReason.',
	[SdkErrorCode.RESOURCES_INVALID]:
		"Fix the resources field named in the message, or omit it to use the snapshot's value.",
	[SdkErrorCode.SANDBOX_FAILED]:
		'Read sandbox.errorReason. Call sandbox.recover() when sandbox.recoverable is true, otherwise delete the sandbox and create a new one.',
	[SdkErrorCode.SNAPSHOT_FAILED]:
		'The sandbox is unchanged and stopped. Delete the failed snapshot, then try the capture again; if it keeps failing, contact support@snapflow.io.',
	[ApiErrorCode.Unauthorized]: UNAUTHORIZED_NEXT_STEP,
	[ApiErrorCode.ValidationFailed]:
		'Fix the parameters listed in the message and retry.',
	[ApiErrorCode.InsufficientCredit]: ADD_FUNDS_NEXT_STEP,
	[ApiErrorCode.PaymentRequired]: ADD_FUNDS_NEXT_STEP,
	[ApiErrorCode.AutomaticPaymentsRequired]:
		"Sandboxes default to voucherSigning: 'delegated', where Snapflow signs vouchers with the organization's delegated signer. Turn on automatic payments (or renew or raise them, as the reason says) on the Funding page of the dashboard, or create the sandbox with voucherSigning: 'client' and sign its vouchers yourself with VoucherSigner.",
	[ApiErrorCode.MonthlyBudgetExhausted]:
		'Raise the monthly budget on the Billing page of the dashboard, or wait for the next billing period.',
	[ApiErrorCode.ApiKeyBudgetExhausted]:
		'Raise the compute budget of this API key in the dashboard, or use another key.',
	[ApiErrorCode.ApiKeyBudgetWouldBeExceeded]:
		'Raise the compute spending limit of this API key in the dashboard, stop some of the running sandboxes it started, or use another key.',
	[ApiErrorCode.ApiKeyConcurrencyExhausted]:
		'Stop a sandbox started with this API key, or raise its budget in the dashboard.',
	[ApiErrorCode.SandboxQuotaExceeded]:
		'Stop, archive or delete sandboxes you no longer need, or contact support@snapflow.io to raise the organization limits. Settings > Limits in the dashboard shows current usage.',
	[ApiErrorCode.SandboxResourceLimitExceeded]:
		'Request fewer resources, or contact support@snapflow.io to raise the per-sandbox limit.',
	[ApiErrorCode.PersistentSandboxNotAllowed]:
		'Create the sandbox with mode: SandboxMode.Ephemeral.',
	[ApiErrorCode.SandboxClassNotAllowed]:
		'Choose another sandbox class, or contact support@snapflow.io to enable it.',
	[ApiErrorCode.NoAvailableMachine]:
		'Widen placement.locations or the GPU types, remove placement.machineId, or retry later.',
	[ApiErrorCode.MachineUnavailable]:
		'Retry with one of error.alternatives as placement.machineId, or omit placement.machineId to let Snapflow choose.',
	[ApiErrorCode.PriceChanged]:
		'Review error.quote, then retry with its price card as placement.expectedPriceCardId.',
	[ApiErrorCode.PriceAboveMaximum]:
		'Raise placement.maxHourlyPriceMicroUsd, or choose a cheaper listing.',
	[ApiErrorCode.SandboxStateChangeInProgress]:
		'Wait for the current change with sandbox.waitUntilStarted() or sandbox.waitUntilStopped(), then retry.',
	[ApiErrorCode.OperationInProgress]:
		'Wait for the running operation to finish, then retry.',
	[ApiErrorCode.ResourceModified]: 'Fetch the resource again, then retry.',
	[ApiErrorCode.SandboxNotFound]:
		'Check the sandbox ID or name; the sandbox may have been deleted.',
	[ApiErrorCode.SandboxStateInvalid]:
		'Call sandbox.refreshData(), check sandbox.state, and retry once the sandbox is in a state that allows the operation.',
	[ApiErrorCode.SandboxErrored]:
		'Call sandbox.recover() when sandbox.recoverable is true, otherwise delete the sandbox and create a new one.',
	[ApiErrorCode.SandboxNameTaken]: 'Use another sandbox name.',
	[ApiErrorCode.SnapshotNotFound]:
		'Check the snapshot ID or name; create the snapshot first if it does not exist.',
	[ApiErrorCode.SnapshotNotReady]:
		'Wait until the snapshot is active, then retry.',
	[ApiErrorCode.SnapshotDiskTooSmall]:
		'Request at least the disk size named in the message, or use a smaller snapshot.',
	[ApiErrorCode.VolumeNotFound]:
		'Check the volume ID or name; the volume may have been deleted.',
	[ApiErrorCode.GpuTypeNotAllowed]:
		'Request one of the GPU types listed in the message, or contact support@snapflow.io to enable more.',
	[ApiErrorCode.CursorInvalid]:
		'List again from the first page without a cursor.',
	[ApiErrorCode.ResourceVersionRequired]:
		'Fetch the resource and send its version in the If-Match header.',
	[ApiErrorCode.ResourceVersionInvalid]:
		'Fetch the resource and send its current version in the If-Match header.',
	[ApiErrorCode.TermsAcceptanceRequired]:
		'Sign in to the Snapflow dashboard as the user who created this API key and accept the current Terms of Service, then retry.',
	[ApiErrorCode.MaintenanceMode]:
		'Snapflow is under maintenance. Retry after a few minutes.',
	[ApiErrorCode.IdempotencyKeyReused]:
		'Use a new idempotencyKey for a request with different parameters.',
	[ApiErrorCode.IdempotencyRequestInProgress]:
		'Wait for the first request with this idempotencyKey to finish, then retry.',
	[ApiErrorCode.FundingWalletRequired]:
		'Link a funding wallet on the Wallet page of the dashboard before creating paid sandboxes.',
	[ApiErrorCode.RateLimited]: RATE_LIMITED_NEXT_STEP,
	[ApiErrorCode.InternalError]: RETRY_LATER_NEXT_STEP,
	[ApiErrorCode.ServiceUnavailable]: RETRY_LATER_NEXT_STEP,
	[ApiErrorCode.GatewayTimeout]: RETRY_LATER_NEXT_STEP,
};

const STATUS_NEXT_STEPS: Readonly<Record<number, string>> = {
	[HttpStatus.BAD_REQUEST]: 'Check the request parameters and retry.',
	[HttpStatus.UNAUTHORIZED]: UNAUTHORIZED_NEXT_STEP,
	[HttpStatus.PAYMENT_REQUIRED]: ADD_FUNDS_NEXT_STEP,
	[HttpStatus.FORBIDDEN]:
		'Use an API key of this organization that has the required permissions.',
	[HttpStatus.NOT_FOUND]:
		'Check the ID or name; the resource may have been deleted.',
	[HttpStatus.REQUEST_TIMEOUT]:
		'Pass a larger timeout, or run the work in the background.',
	[HttpStatus.CONFLICT]: 'Fetch the latest state, then retry.',
	[HttpStatus.TOO_MANY_REQUESTS]: RATE_LIMITED_NEXT_STEP,
};

function isSnapflowErrorCode(code: string): code is SnapflowErrorCode {
	return Object.hasOwn(NEXT_STEPS, code);
}

export function nextStepFor(
	errorCode: string | undefined,
	statusCode: number | undefined
): string | undefined {
	if (errorCode !== undefined && isSnapflowErrorCode(errorCode)) {
		return NEXT_STEPS[errorCode];
	}
	if (statusCode === undefined) return undefined;
	if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
		return RETRY_LATER_NEXT_STEP;
	}
	return STATUS_NEXT_STEPS[statusCode];
}
