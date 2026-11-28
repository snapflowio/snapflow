/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiErrorCode, type BillingRestriction } from '@snapflow/api-client';
import {
	AUTH_ERROR_CODES,
	AuthError,
	type AuthErrorCode,
} from '#lib/api/auth/auth-error-codes.ts';
import { SUPPORT_EMAIL } from '#lib/config/support.ts';
import {
	FUNDING_DIALOG_PARAM,
	FundingDialog,
} from '#lib/routing/funding-dialog.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';

export const ClientErrorCode = {
	UNREACHABLE: 'SNAPFLOW_UNREACHABLE',
	TIMEOUT: 'SNAPFLOW_TIMEOUT',
	WALLET_REQUEST_REJECTED: 'SNAPFLOW_WALLET_REQUEST_REJECTED',
	WALLET_WRONG_NETWORK: 'SNAPFLOW_WALLET_WRONG_NETWORK',
	WALLET_INSUFFICIENT_GAS: 'SNAPFLOW_WALLET_INSUFFICIENT_GAS',
	WALLET_NOT_CONNECTED: 'SNAPFLOW_WALLET_NOT_CONNECTED',
	WALLET_PASSKEY_PROMPT_CLOSED: 'SNAPFLOW_WALLET_PASSKEY_PROMPT_CLOSED',
	WALLET_PASSKEY_MISSING: 'SNAPFLOW_WALLET_PASSKEY_MISSING',
} as const;

export type ClientErrorCode =
	(typeof ClientErrorCode)[keyof typeof ClientErrorCode];

export type ErrorCode = ApiErrorCode | ClientErrorCode | AuthErrorCode;

export interface ErrorCatalogAction {
	label: string;
	path: Path;
	search?: Readonly<Record<string, string>>;
}

export function errorActionHref(action: ErrorCatalogAction): string {
	const path = resolvePath(action.path);
	return action.search ? `${path}?${new URLSearchParams(action.search)}` : path;
}

export interface ErrorCatalogEntry {
	title?: string;
	message?: string;
	fallback?: string;
	action?: ErrorCatalogAction;
}

export type ErrorNotice = Required<
	Pick<ErrorCatalogEntry, 'title' | 'message' | 'action'>
>;

const HttpStatus = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	PAYMENT_REQUIRED: 402,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	GONE: 410,
	PAYLOAD_TOO_LARGE: 413,
	UNPROCESSABLE_ENTITY: 422,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_SERVER_ERROR: 500,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
	GATEWAY_TIMEOUT: 504,
} as const;

const REQUEST_FAILED_MESSAGE = 'The request failed. Try again.';

const ErrorAction = {
	ADD_FUNDS: {
		label: 'Add funds',
		path: Path.BILLING,
		search: { [FUNDING_DIALOG_PARAM]: FundingDialog.Deposit },
	},
	OPEN_BILLING: { label: 'Open billing', path: Path.BILLING },
	OPEN_API_KEYS: { label: 'Open API keys', path: Path.SETTINGS_API_KEYS },
	OPEN_LIMITS: { label: 'View limits', path: Path.SETTINGS_LIMITS },
	BROWSE_LISTINGS: { label: 'Browse listings', path: Path.LISTINGS },
	OPEN_SECURITY: {
		label: 'Open security settings',
		path: Path.ACCOUNT_SECURITY,
	},
	OPEN_WALLET: { label: 'Open wallet', path: Path.BILLING_WALLET },
	OPEN_HOST_PROFILE: { label: 'Open host profile', path: Path.HOST_PROFILE },
	OPEN_SANDBOXES: { label: 'Open sandboxes', path: Path.SANDBOXES },
	OPEN_SNAPSHOTS: { label: 'Open snapshots', path: Path.SNAPSHOTS },
	OPEN_VOLUMES: { label: 'Open volumes', path: Path.VOLUMES },
	OPEN_REGISTRIES: { label: 'Open registries', path: Path.REGISTRIES },
	OPEN_SECRETS: { label: 'Open secrets', path: Path.SECRETS },
	TURN_ON_AUTOMATIC_PAYMENTS: {
		label: 'Turn on payments',
		path: Path.BILLING,
		search: { [FUNDING_DIALOG_PARAM]: FundingDialog.AutomaticPayments },
	},
} as const satisfies Record<string, ErrorCatalogAction>;

const BILLING_RESTRICTION_NOTICES = {
	[ApiErrorCode.InsufficientCredit]: {
		title: 'Not enough funds to start this sandbox',
		message:
			'A sandbox starts only while the balance covers an hour of everything that would then run. Deposit more USDC, then start it.',
		action: ErrorAction.ADD_FUNDS,
	},
	[ApiErrorCode.MonthlyBudgetExhausted]: {
		title: 'Monthly budget exhausted',
		message: 'Raise the budget or wait for the next period.',
		action: ErrorAction.OPEN_BILLING,
	},
	[ApiErrorCode.ApiKeyBudgetExhausted]: {
		title: 'API key compute limit reached',
		message:
			'This API key reached its 30-day compute spend limit. Raise it on the API keys page or use another key.',
		action: ErrorAction.OPEN_API_KEYS,
	},
	[ApiErrorCode.ApiKeyBudgetWouldBeExceeded]: {
		title: 'API key compute limit too close',
		message:
			"Starting this sandbox would take this API key past its compute spend limit before the next budget check. Raise the limit on the API keys page or stop some of the key's running sandboxes.",
		action: ErrorAction.OPEN_API_KEYS,
	},
	[ApiErrorCode.ApiKeyConcurrencyExhausted]: {
		title: 'API key sandbox limit reached',
		message:
			'This API key already runs as many sandboxes as its budget allows. Stop one or raise the limit on the API keys page.',
		action: ErrorAction.OPEN_API_KEYS,
	},
} as const satisfies Record<BillingRestriction, ErrorNotice>;

const ERROR_CATALOG: Readonly<Partial<Record<ErrorCode, ErrorCatalogEntry>>> = {
	[ClientErrorCode.UNREACHABLE]: {
		message: "Can't reach Snapflow. Check your connection and try again.",
	},
	[ClientErrorCode.TIMEOUT]: {
		message: 'The request took too long. Try again.',
	},
	[ApiErrorCode.BadRequest]: {
		fallback: 'The request is invalid. Check the values and try again.',
	},
	[ApiErrorCode.ValidationFailed]: {
		fallback: 'Some fields are invalid. Correct them and try again.',
	},
	[ApiErrorCode.Unauthorized]: {
		fallback: 'Your session has expired. Sign in again.',
	},
	[ApiErrorCode.PaymentRequired]: {
		fallback: 'This action needs more funds. Add funds and try again.',
		action: ErrorAction.ADD_FUNDS,
	},
	[ApiErrorCode.Forbidden]: {
		fallback:
			'You do not have permission to do this. Ask an owner or admin of the organization for access.',
	},
	[ApiErrorCode.NotFound]: {
		fallback: 'This item no longer exists or was never created.',
	},
	[ApiErrorCode.Conflict]: {
		fallback: 'This item changed in the meantime. Reload and try again.',
	},
	[ApiErrorCode.Gone]: { fallback: 'This item no longer exists.' },
	[ApiErrorCode.PayloadTooLarge]: {
		fallback: 'The upload is too large. Send a smaller file.',
	},
	[ApiErrorCode.Unprocessable]: {
		fallback: 'The request could not be processed. Check the values.',
	},
	[ApiErrorCode.RateLimited]: {
		fallback: 'Too many requests. Wait a moment and try again.',
	},
	[ApiErrorCode.InternalError]: {
		fallback: `Something went wrong on our side. Try again; if it keeps happening, contact ${SUPPORT_EMAIL}.`,
	},
	[ApiErrorCode.ServiceUnavailable]: {
		fallback: 'Snapflow is temporarily unavailable. Try again in a moment.',
	},
	[ApiErrorCode.GatewayTimeout]: {
		fallback: 'Snapflow took too long to answer. Try again in a moment.',
	},
	[ApiErrorCode.RequestFailed]: { fallback: REQUEST_FAILED_MESSAGE },
	...BILLING_RESTRICTION_NOTICES,
	[ApiErrorCode.AutomaticPaymentsRequired]: {
		title: 'Automatic payments are needed',
		message:
			'Snapflow pays hosts for this sandbox through automatic payments from your funding wallet. Turn them on, or renew or raise them, then try again.',
		action: ErrorAction.TURN_ON_AUTOMATIC_PAYMENTS,
	},
	[ApiErrorCode.SandboxQuotaExceeded]: { action: ErrorAction.OPEN_LIMITS },
	[ApiErrorCode.SandboxResourceLimitExceeded]: {
		action: ErrorAction.OPEN_LIMITS,
	},
	[ApiErrorCode.SnapflowStorageCapReached]: {
		action: ErrorAction.OPEN_SANDBOXES,
	},
	[ApiErrorCode.NoAvailableMachine]: {
		action: ErrorAction.BROWSE_LISTINGS,
	},
	[ApiErrorCode.MachineUnavailable]: {
		action: ErrorAction.BROWSE_LISTINGS,
	},
	[ApiErrorCode.AdminMfaRequired]: { action: ErrorAction.OPEN_SECURITY },
	[ApiErrorCode.SandboxNotFound]: { action: ErrorAction.OPEN_SANDBOXES },
	[ApiErrorCode.SandboxErrored]: { action: ErrorAction.OPEN_SANDBOXES },
	[ApiErrorCode.SandboxHasForks]: { action: ErrorAction.OPEN_SANDBOXES },
	[ApiErrorCode.SnapshotNotFound]: { action: ErrorAction.OPEN_SNAPSHOTS },
	[ApiErrorCode.SnapshotNotReady]: { action: ErrorAction.OPEN_SNAPSHOTS },
	[ApiErrorCode.SnapshotRequired]: { action: ErrorAction.OPEN_SNAPSHOTS },
	[ApiErrorCode.SnapshotDiskTooSmall]: { action: ErrorAction.OPEN_SNAPSHOTS },
	[ApiErrorCode.VolumeNotFound]: { action: ErrorAction.OPEN_VOLUMES },
	[ApiErrorCode.VolumeInUse]: { action: ErrorAction.OPEN_VOLUMES },
	[ApiErrorCode.DockerRegistryNotFound]: {
		action: ErrorAction.OPEN_REGISTRIES,
	},
	[ApiErrorCode.DockerRegistryLimitReached]: {
		action: ErrorAction.OPEN_REGISTRIES,
	},
	[ApiErrorCode.SecretNameTaken]: { action: ErrorAction.OPEN_SECRETS },
	[ApiErrorCode.SecretBindingsLimitExceeded]: {
		action: ErrorAction.OPEN_SECRETS,
	},
	[ApiErrorCode.GpuTypeNotAllowed]: { action: ErrorAction.OPEN_LIMITS },
	[ApiErrorCode.SandboxClassNotAllowed]: { action: ErrorAction.OPEN_LIMITS },
	[ApiErrorCode.PersistentSandboxNotAllowed]: {
		action: ErrorAction.OPEN_LIMITS,
	},
	[ApiErrorCode.QuotaIncreaseRequestAlreadyPending]: {
		action: ErrorAction.OPEN_LIMITS,
	},
	[ApiErrorCode.QuotaIncreaseRequestNotPending]: {
		message: 'This request was already reviewed. Reload the queue.',
	},
	[ApiErrorCode.ApiKeyNotFound]: { action: ErrorAction.OPEN_API_KEYS },
	[ApiErrorCode.CursorInvalid]: {
		message: 'This list changed. Reload it to start from the first page.',
	},
	[ApiErrorCode.FundingWalletRequired]: {
		message: 'Link a funding wallet before paying for sandboxes.',
		action: ErrorAction.OPEN_WALLET,
	},
	[ApiErrorCode.UserWalletNotFound]: {
		message: 'You have no wallet yet. Create one first.',
		action: ErrorAction.OPEN_WALLET,
	},
	[ApiErrorCode.PayoutWalletRequired]: {
		message: 'Set a payout wallet before listing machines or withdrawing.',
		action: ErrorAction.OPEN_HOST_PROFILE,
	},
	[ApiErrorCode.WalletFeeTooLow]: {
		message:
			'The network fee went up since it was quoted. Try again for a new quote.',
	},
	[ApiErrorCode.WalletFeeAboveCap]: {
		message:
			'The network fee is above what Snapflow relays right now. Try again later.',
	},
	[ApiErrorCode.WalletFeeInvalid]: {
		message:
			'The signed transaction did not pay the quoted network fee. Try again.',
	},
	[ApiErrorCode.WalletInsufficientUsdcForGas]: {
		message:
			'Your wallet does not hold enough USDC for this transaction and its network fee.',
		action: ErrorAction.ADD_FUNDS,
	},
	[ApiErrorCode.SettlementChainUnavailable]: {
		message:
			'The payment network is unreachable right now. Try again in a moment.',
	},
	[ApiErrorCode.MachineNotBenchmarked]: {
		message:
			'This machine has not passed a benchmark for its current hardware yet. Request a benchmark from the verification panel first.',
	},
	[ApiErrorCode.GpuRateMismatch]: {
		message:
			'Set a GPU rate exactly when the machine has GPUs. Reload the machine and publish again.',
	},
	[ApiErrorCode.MachineRestricted]: {
		message: 'This machine is restricted, so it cannot be priced or listed.',
	},
	[ClientErrorCode.WALLET_REQUEST_REJECTED]: {
		message:
			'You declined the request in your wallet, so nothing was signed or sent.',
	},
	[ClientErrorCode.WALLET_WRONG_NETWORK]: {
		message:
			'Your wallet is on another network. Switch it to the Snapflow payment network and try again.',
	},
	[ClientErrorCode.WALLET_INSUFFICIENT_GAS]: {
		message:
			"Your wallet does not hold enough of the network's gas token to pay for this transaction. Top it up and try again.",
	},
	[ClientErrorCode.WALLET_NOT_CONNECTED]: {
		message: 'Your wallet is not connected. Connect it and try again.',
	},
	[ClientErrorCode.WALLET_PASSKEY_PROMPT_CLOSED]: {
		message:
			'The passkey prompt was closed or timed out, so nothing was signed. Try again and confirm with your passkey.',
	},
	[ClientErrorCode.WALLET_PASSKEY_MISSING]: {
		message:
			'The passkey that owns your wallet is not on this account anymore. Use your recovery owner instead.',
		action: ErrorAction.OPEN_WALLET,
	},
	[AuthError.INVALID_OTP.code]: {
		message: 'Invalid verification code. Check it and try again.',
	},
	[AuthError.OTP_EXPIRED.code]: {
		message: 'The verification code has expired. Request a new one.',
	},
	[AuthError.TOO_MANY_ATTEMPTS.code]: {
		message: 'Too many failed attempts. Request a new code.',
	},
	[AuthError.INVALID_CODE.code]: {
		message:
			'Invalid code. Check your authenticator app and enter the current code.',
	},
	[AuthError.INVALID_BACKUP_CODE.code]: {
		message: 'Invalid backup code. Check it and try again.',
	},
	[AuthError.OTP_HAS_EXPIRED.code]: {
		message: 'The code has expired. Request a new one.',
	},
	[AuthError.TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE.code]: {
		message: 'Too many failed attempts. Request a new code.',
	},
	[AuthError.ACCOUNT_TEMPORARILY_LOCKED.code]: {
		message:
			'Your account is temporarily locked after too many failed attempts. Wait a few minutes and try again.',
	},
	[AuthError.SESSION_EXPIRED.code]: {
		message:
			'Your session has expired. Sign out and sign back in, then try again.',
	},
	[AuthError.AUTH_CANCELLED.code]: {
		message: 'The passkey prompt was closed or timed out. Try again.',
	},
	[AuthError.REGISTRATION_CANCELLED.code]: {
		message:
			'The passkey prompt was closed or timed out, so no passkey was added. Try again.',
	},
	[AuthError.PREVIOUSLY_REGISTERED.code]: {
		message: 'This passkey is already registered on your account.',
		action: ErrorAction.OPEN_SECURITY,
	},
	[AuthError.PASSKEY_NOT_FOUND.code]: {
		message:
			'This passkey is not registered with Snapflow. Sign in another way, then add it again.',
	},
	[AuthError.INVITATION_NOT_FOUND.code]: {
		message: 'This invitation is invalid or no longer exists.',
	},
	[AuthError.YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION.code]: {
		message:
			'This invitation was sent to another email address. Sign in with that account to accept it.',
	},
	[AuthError.USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION.code]: {
		message: 'This person already has a pending invitation.',
	},
	[AuthError.USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION.code]: {
		message: 'This person is already a member of the organization.',
	},
	[AuthError.BANNED_USER.code]: {
		message: `This account is suspended. Contact ${SUPPORT_EMAIL} if you think this is a mistake.`,
	},
};

const STATUS_ERROR_CODES: Readonly<Record<number, ApiErrorCode>> = {
	[HttpStatus.BAD_REQUEST]: ApiErrorCode.BadRequest,
	[HttpStatus.UNAUTHORIZED]: ApiErrorCode.Unauthorized,
	[HttpStatus.PAYMENT_REQUIRED]: ApiErrorCode.PaymentRequired,
	[HttpStatus.FORBIDDEN]: ApiErrorCode.Forbidden,
	[HttpStatus.NOT_FOUND]: ApiErrorCode.NotFound,
	[HttpStatus.CONFLICT]: ApiErrorCode.Conflict,
	[HttpStatus.GONE]: ApiErrorCode.Gone,
	[HttpStatus.PAYLOAD_TOO_LARGE]: ApiErrorCode.PayloadTooLarge,
	[HttpStatus.UNPROCESSABLE_ENTITY]: ApiErrorCode.Unprocessable,
	[HttpStatus.TOO_MANY_REQUESTS]: ApiErrorCode.RateLimited,
	[HttpStatus.INTERNAL_SERVER_ERROR]: ApiErrorCode.InternalError,
	[HttpStatus.BAD_GATEWAY]: ApiErrorCode.ServiceUnavailable,
	[HttpStatus.SERVICE_UNAVAILABLE]: ApiErrorCode.ServiceUnavailable,
	[HttpStatus.GATEWAY_TIMEOUT]: ApiErrorCode.GatewayTimeout,
};

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set<string>([
	...Object.values(ApiErrorCode),
	...Object.values(ClientErrorCode),
	...AUTH_ERROR_CODES,
]);

export function isKnownErrorCode(code: string | null): code is ErrorCode {
	return code !== null && KNOWN_ERROR_CODES.has(code);
}

export function catalogEntry(
	code: string | null
): ErrorCatalogEntry | undefined {
	return isKnownErrorCode(code) ? ERROR_CATALOG[code] : undefined;
}

export function billingRestrictionNotice(
	restriction: BillingRestriction
): ErrorNotice {
	return BILLING_RESTRICTION_NOTICES[restriction];
}

export function statusFallbackMessage(status: number | null): string {
	const code = status === null ? undefined : STATUS_ERROR_CODES[status];
	return (
		(code === undefined ? undefined : ERROR_CATALOG[code]?.fallback) ??
		REQUEST_FAILED_MESSAGE
	);
}
