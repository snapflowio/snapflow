/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AutomaticPaymentsGap,
	type AutoTopUp,
	AutoTopUpStatus,
	type BillingOverviewDto,
	type EscrowAccount,
	EscrowSignerStatus,
	type VoucherDelegation,
	VoucherLimit,
} from '@snapflow/api-client';
import { SUPPORT_HREF } from '#lib/config/support.ts';
import { FundingDialog } from '#lib/routing/funding-dialog.ts';
import { formatDate, formatDateTime } from '#lib/utils/format.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';
import { formatSeconds } from './escrow-terms.ts';
import { fundingDialogHref } from './funding-dialog-link.ts';

const BASIS_POINTS_PER_PERCENT = 100;
const MAXIMUM_PERCENT = 100;
const SECONDS_PER_HOUR = 3_600;
const HOURS_PER_DAY = 24;
const SIGNER_EXPIRY_WARNING_DAYS = 3;
const MILLISECONDS_PER_SECOND = 1_000;

export const START_RUNWAY_SECONDS = SECONDS_PER_HOUR;
export const LOW_RUNWAY_SECONDS = HOURS_PER_DAY * SECONDS_PER_HOUR;
export const SIGNER_EXPIRY_WARNING_SECONDS =
	SIGNER_EXPIRY_WARNING_DAYS * HOURS_PER_DAY * SECONDS_PER_HOUR;

type Funding = BillingOverviewDto['funding'];
type FundingState = Funding['state'];
type SignerGrant = NonNullable<VoucherDelegation['delegatedSigner']>;

export const BillingFix = {
	Funding: 'funding',
	SignerLimit: 'signer-limit',
	Signer: 'signer',
	AutoTopUp: 'auto-top-up',
	SpendLimits: 'spend-limits',
	Support: 'support',
} as const;

export type BillingFix = (typeof BillingFix)[keyof typeof BillingFix];

export const BILLING_FIX_LABELS = {
	[BillingFix.Funding]: 'Add funds',
	[BillingFix.SignerLimit]: 'Raise limit',
	[BillingFix.Signer]: 'Turn on payments',
	[BillingFix.AutoTopUp]: 'Check auto top-up',
	[BillingFix.SpendLimits]: 'Spend limits',
	[BillingFix.Support]: 'Contact support',
} as const satisfies Record<BillingFix, string>;

export const BILLING_BANNER_FIX_LABEL = 'Fix';

const FIX_DIALOGS = {
	[BillingFix.Funding]: FundingDialog.Deposit,
	[BillingFix.SignerLimit]: FundingDialog.SignerLimit,
	[BillingFix.Signer]: FundingDialog.AutomaticPayments,
	[BillingFix.AutoTopUp]: FundingDialog.AutoTopUp,
	[BillingFix.SpendLimits]: FundingDialog.SpendLimits,
} as const satisfies Record<Exclude<BillingFix, 'support'>, FundingDialog>;

export function billingFixHref(fix: BillingFix): string {
	return fix === BillingFix.Support
		? SUPPORT_HREF
		: fundingDialogHref(FIX_DIALOGS[fix]);
}

const NoticeReach = { App: true, Billing: false } as const;

function notice<const Tone extends 'info' | 'warning' | 'error'>(
	tone: Tone,
	title: string,
	description: string,
	fix: BillingFix,
	appWide: boolean
) {
	return { tone, title, description, fix, appWide } as const;
}

export type BillingNotice = ReturnType<typeof notice>;

export interface BillingAttentionSources {
	overview: BillingOverviewDto | undefined;
	delegation: VoucherDelegation | undefined;
	autoTopUp: AutoTopUp | undefined;
	account?: EscrowAccount | undefined;
}

const AUTO_TOP_UP_ADVICE = {
	[AutoTopUpStatus.Disabled]: 'Deposit more USDC or turn on auto top-up.',
	[AutoTopUpStatus.NotAuthorized]:
		'Deposit more USDC, or approve auto top-up from the funding wallet.',
	[AutoTopUpStatus.Active]: 'Deposit more USDC or raise the top-up amount.',
	[AutoTopUpStatus.Failing]: 'Auto top-up is failing, so deposit by hand.',
} as const satisfies Record<AutoTopUpStatus, string>;

const UNKNOWN_TOP_UP_ADVICE = 'Deposit more USDC.';

function refillAdvice(autoTopUp: AutoTopUp | undefined): string {
	return autoTopUp
		? AUTO_TOP_UP_ADVICE[autoTopUp.status]
		: UNKNOWN_TOP_UP_ADVICE;
}

export function runwaySecondsOf(
	runwaySeconds: string | null | undefined
): number | null {
	if (runwaySeconds === null || runwaySeconds === undefined) return null;
	const seconds = Math.floor(Number(runwaySeconds));
	return Number.isFinite(seconds) ? seconds : null;
}

export function formatRunway(runwaySeconds: string | null | undefined) {
	const seconds = runwaySecondsOf(runwaySeconds);
	return seconds === null ? null : formatSeconds(seconds);
}

function frozenNotice(
	account: EscrowAccount | undefined
): BillingNotice | null {
	if (!account?.blockedAt) return null;
	return notice(
		'error',
		account.blockedUntil
			? `Funding wallet frozen until ${formatDate(account.blockedUntil)}`
			: 'Funding wallet frozen',
		'Deposits and new sandboxes are blocked. Held funds are never seized.',
		BillingFix.Support,
		NoticeReach.App
	);
}

function outOfFundsNotice(
	overview: BillingOverviewDto | undefined,
	autoTopUp: AutoTopUp | undefined
): BillingNotice | null {
	if (!overview) return null;
	const { funding } = overview;
	if (funding.computeStoppedAt) {
		return notice(
			'error',
			`Compute stopped on ${formatDateTime(funding.computeStoppedAt)}`,
			funding.archivesDeleteAt
				? `Sandboxes are archived and deleted on ${formatDate(funding.archivesDeleteAt)} unless you deposit.`
				: 'Every sandbox was archived. Deposit to start them again.',
			BillingFix.Funding,
			NoticeReach.App
		);
	}
	if (
		overview.admissionBlockers.includes('funding_exhausted') ||
		overview.automaticPayments?.reason === VoucherLimit.CustomerBalance
	) {
		return notice(
			'error',
			'Funds are exhausted',
			'Sandboxes are paused until you deposit more USDC.',
			BillingFix.Funding,
			NoticeReach.App
		);
	}
	const runway = runwaySecondsOf(funding.runwaySeconds);
	if (runway !== null && runway < START_RUNWAY_SECONDS) {
		return notice(
			'error',
			'Less than an hour of funds left',
			refillAdvice(autoTopUp),
			BillingFix.Funding,
			NoticeReach.App
		);
	}
	if (funding.state === 'restricted') {
		return notice(
			'error',
			'New sandbox starts are blocked',
			'Funds or a spend limit ran out, or automatic payments are off.',
			BillingFix.SpendLimits,
			NoticeReach.App
		);
	}
	return null;
}

const REPLACEABLE_SIGNER_STATUSES: ReadonlySet<EscrowSignerStatus> = new Set([
	EscrowSignerStatus.Revocable,
	EscrowSignerStatus.Revoked,
	EscrowSignerStatus.Expired,
]);

export function signerReplaceable(status: EscrowSignerStatus | null): boolean {
	return status !== null && REPLACEABLE_SIGNER_STATUSES.has(status);
}

export function automaticPaymentsAuthorizable(
	delegation: VoucherDelegation
): boolean {
	const grant = delegation.delegatedSigner;
	return grant === null || signerReplaceable(grant.status);
}

export function lowestHourlyCap(grant: SignerGrant): bigint {
	const current = BigInt(grant.hourlyCap);
	const scheduled =
		grant.pendingHourlyCap === null ? null : BigInt(grant.pendingHourlyCap);
	return scheduled !== null && scheduled < current ? scheduled : current;
}

export function signerLimitShort(delegation: VoucherDelegation): boolean {
	const grant = delegation.delegatedSigner;
	return (
		grant?.status === EscrowSignerStatus.Active &&
		lowestHourlyCap(grant) < BigInt(delegation.hourlySpendMicroUsd)
	);
}

function secondsUntilExpiry(delegation: VoucherDelegation, grant: SignerGrant) {
	const expiresAt =
		new Date(grant.expiresAt).getTime() / MILLISECONDS_PER_SECOND;
	return expiresAt - Number(delegation.chainNowSeconds);
}

export const PAYMENT_HOLD_COPY = {
	[VoucherLimit.SignerMissing]: {
		title: 'Automatic payments are off',
		paused: 'automatic payments are off',
		fix: BillingFix.Signer,
	},
	[VoucherLimit.SignerRevoked]: {
		title: 'Automatic payments were revoked',
		paused: 'automatic payments were revoked',
		fix: BillingFix.Signer,
	},
	[VoucherLimit.SignerThawing]: {
		title: 'Automatic payments are stopping',
		paused: 'automatic payments are stopping',
		fix: BillingFix.Signer,
	},
	[VoucherLimit.SignerExpired]: {
		title: 'Automatic payments expired',
		paused: 'automatic payments expired',
		fix: BillingFix.Signer,
	},
	[VoucherLimit.SignerScope]: {
		title: 'Automatic payments do not cover the marketplace fee',
		paused: 'automatic payments do not cover this host',
		fix: BillingFix.Signer,
	},
	[VoucherLimit.SignerCap]: {
		title: 'Hourly spending limit is below running costs',
		paused: 'the hourly spending limit was reached',
		fix: BillingFix.SignerLimit,
	},
	[VoucherLimit.CustomerBalance]: {
		title: 'Funds are exhausted',
		paused: 'the escrow balance ran out',
		fix: BillingFix.Funding,
	},
} as const satisfies Record<
	VoucherLimit,
	{ title: string; paused: string; fix: BillingFix }
>;

export const PAYMENT_HOLD_PENDING_LABEL = 'payments are catching up';

export function automaticPaymentsDescription(
	gap: AutomaticPaymentsGap
): string {
	switch (gap.reason) {
		case VoucherLimit.SignerExpired:
			return gap.expiresAt
				? `They expired on ${formatDateTime(gap.expiresAt)}. Turn them on again before starting billable sandboxes.`
				: 'Turn them on again before starting billable sandboxes.';
		case VoucherLimit.SignerCap:
			return `Running sandboxes cost ${formatHourlyPrice(gap.hourlySpendMicroUsd)} but the limit is ${gap.hourlyCapMicroUsd === null ? 'lower' : formatHourlyPrice(gap.hourlyCapMicroUsd)}.`;
		default:
			return 'Billable sandboxes cannot start and running ones pause once payments fall behind.';
	}
}

function automaticPaymentsNotice(
	overview: BillingOverviewDto | undefined
): BillingNotice | null {
	const gap = overview?.automaticPayments;
	if (!gap || gap.reason === VoucherLimit.CustomerBalance) return null;
	const copy = PAYMENT_HOLD_COPY[gap.reason];
	return notice(
		'error',
		copy.title,
		automaticPaymentsDescription(gap),
		copy.fix,
		NoticeReach.App
	);
}

function autoTopUpNotice(
	autoTopUp: AutoTopUp | undefined
): BillingNotice | null {
	if (autoTopUp?.status !== AutoTopUpStatus.Failing) return null;
	return notice(
		'error',
		autoTopUp.lastFailedAt
			? `Auto top-up failed on ${formatDateTime(autoTopUp.lastFailedAt)}`
			: 'Auto top-up is failing',
		autoTopUp.lastError ?? "Check the funding wallet's USDC and allowance.",
		BillingFix.AutoTopUp,
		NoticeReach.Billing
	);
}

function outOfSyncNotice(
	autoTopUp: AutoTopUp | undefined
): BillingNotice | null {
	if (!(autoTopUp?.enabled && !autoTopUp.inSync)) return null;
	return notice(
		'warning',
		'Auto top-up terms are out of sync',
		'Apply them again from the funding wallet.',
		BillingFix.AutoTopUp,
		NoticeReach.Billing
	);
}

function budgetNotice(
	overview: BillingOverviewDto | undefined
): BillingNotice | null {
	if (!overview?.admissionBlockers.includes('monthly_budget_exhausted')) {
		return null;
	}
	return notice(
		'error',
		'Monthly spend limit reached',
		'Raise it before starting new billable sandboxes.',
		BillingFix.SpendLimits,
		NoticeReach.Billing
	);
}

function lowRunwayNotice(
	overview: BillingOverviewDto | undefined,
	autoTopUp: AutoTopUp | undefined
): BillingNotice | null {
	const runway = runwaySecondsOf(overview?.funding.runwaySeconds);
	if (runway === null || runway >= LOW_RUNWAY_SECONDS) return null;
	return notice(
		'warning',
		`About ${formatSeconds(runway)} of funds left`,
		refillAdvice(autoTopUp),
		BillingFix.Funding,
		NoticeReach.Billing
	);
}

function signerNotice(
	delegation: VoucherDelegation | undefined
): BillingNotice | null {
	const grant = delegation?.delegatedSigner;
	if (!(delegation && grant?.status === EscrowSignerStatus.Active)) {
		return null;
	}
	if (secondsUntilExpiry(delegation, grant) >= SIGNER_EXPIRY_WARNING_SECONDS) {
		return null;
	}
	return notice(
		'warning',
		`Automatic payments stop on ${formatDate(grant.expiresAt)}`,
		'Turn them on again before then.',
		BillingFix.Signer,
		NoticeReach.Billing
	);
}

function fundingStateNotice(
	state: FundingState | undefined,
	autoTopUp: AutoTopUp | undefined
): BillingNotice | null {
	if (state !== 'warning') return null;
	return notice(
		'warning',
		'Funds are running low',
		refillAdvice(autoTopUp),
		BillingFix.Funding,
		NoticeReach.Billing
	);
}

function billingNotices({
	overview,
	delegation,
	autoTopUp,
	account,
}: BillingAttentionSources): BillingNotice[] {
	return [
		frozenNotice(account),
		outOfFundsNotice(overview, autoTopUp),
		automaticPaymentsNotice(overview),
		autoTopUpNotice(autoTopUp),
		outOfSyncNotice(autoTopUp),
		budgetNotice(overview),
		lowRunwayNotice(overview, autoTopUp),
		signerNotice(delegation),
		fundingStateNotice(overview?.funding.state, autoTopUp),
	].filter((each) => each !== null);
}

export function billingOverviewNotice(
	sources: BillingAttentionSources
): BillingNotice | null {
	return billingNotices(sources)[0] ?? null;
}

export function billingAttentionNotice(
	sources: BillingAttentionSources
): BillingNotice | null {
	return (
		billingNotices(sources).find(
			(each) => each.appWide && each.tone === 'error'
		) ?? null
	);
}

export function hasActiveBurn(funding: Funding): boolean {
	return BigInt(funding.currentBurnMicroUsdPerHour) > 0n;
}

export function budgetUsedPercent(
	month: BillingOverviewDto['month']
): number | null {
	if (month.utilizationBasisPoints === undefined) return null;
	return Math.min(
		MAXIMUM_PERCENT,
		Math.round(month.utilizationBasisPoints / BASIS_POINTS_PER_PERCENT)
	);
}
