/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	FundingNoticeKind,
	RunwayWarning,
} from '../../billing/constants/funding.constants';
import type { FundingNotice } from '../../billing/events/funding-notice.event';
import {
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { VoucherLimit } from '../../settlement/enums/voucher-limit.enum';
import {
	DASHBOARD_NOTICE_PATH,
	ENABLE_AUTO_PAY_SEARCH,
	RAISE_SIGNER_LIMIT_SEARCH,
} from '../constants/notice.constants';
import type { NoticeAction, NoticeCopy } from '../types/notice.types';
import { NOTICE_DATE_FORMAT } from './notice-format.util';

const RUNWAY_HEADING = {
	[RunwayWarning.DAY]: 'Less than a day of balance left',
	[RunwayWarning.HOUR]: 'Less than an hour of balance left',
} as const satisfies Record<RunwayWarning, string>;

const DEPOSIT_NOTE =
	'Deposit USDC or turn on auto top-up to keep your sandboxes running.';

const AUTO_PAY_NOTE = 'Turn automatic payments back on to keep them running.';

const ADD_FUNDS: NoticeAction = {
	label: 'Add funds',
	path: DASHBOARD_NOTICE_PATH.BILLING_FUNDING,
};

const ENABLE_AUTO_PAY: NoticeAction = {
	label: 'Turn on automatic payments',
	path: DASHBOARD_NOTICE_PATH.BILLING_FUNDING,
	search: ENABLE_AUTO_PAY_SEARCH,
};

const RAISE_SIGNER_LIMIT: NoticeAction = {
	label: 'Raise the limit',
	path: DASHBOARD_NOTICE_PATH.BILLING_FUNDING,
	search: RAISE_SIGNER_LIMIT_SEARCH,
};

const PAYMENT_HOLD_CAUSE = {
	[VoucherLimit.SIGNER_MISSING]: 'automatic payments are off',
	[VoucherLimit.SIGNER_REVOKED]: 'the automatic payment key was revoked',
	[VoucherLimit.SIGNER_THAWING]: 'automatic payments are being turned off',
	[VoucherLimit.SIGNER_EXPIRED]: 'automatic payments expired',
	[VoucherLimit.SIGNER_SCOPE]:
		'the automatic payment key does not cover this host or fee',
	[VoucherLimit.SIGNER_CAP]: 'the hourly automatic payment limit was reached',
	[VoucherLimit.CUSTOMER_BALANCE]: 'the escrow balance ran out',
} as const satisfies Record<VoucherLimit, string>;

const PAYMENT_HOLD_CATCHING_UP = 'its payments fell behind';

const PAYMENT_HOLD_FIX = {
	[VoucherLimit.SIGNER_MISSING]: ENABLE_AUTO_PAY,
	[VoucherLimit.SIGNER_REVOKED]: ENABLE_AUTO_PAY,
	[VoucherLimit.SIGNER_THAWING]: ENABLE_AUTO_PAY,
	[VoucherLimit.SIGNER_EXPIRED]: {
		...ENABLE_AUTO_PAY,
		label: 'Renew automatic payments',
	},
	[VoucherLimit.SIGNER_SCOPE]: ENABLE_AUTO_PAY,
	[VoucherLimit.SIGNER_CAP]: RAISE_SIGNER_LIMIT,
	[VoucherLimit.CUSTOMER_BALANCE]: ADD_FUNDS,
} as const satisfies Record<VoucherLimit, NoticeAction>;

function plural(count: bigint, unit: string): string {
	return `${count} ${unit}${count === 1n ? '' : 's'}`;
}

function duration(seconds: bigint): string {
	const hours = seconds / BigInt(SECONDS_PER_HOUR);
	if (hours > 0n) return plural(hours, 'hour');
	return plural(seconds / BigInt(SECONDS_PER_MINUTE), 'minute');
}

function formatDate(iso: string): string {
	return NOTICE_DATE_FORMAT.format(new Date(iso));
}

export function fundingNoticeCopy(
	organizationName: string,
	notice: FundingNotice
): NoticeCopy {
	switch (notice.kind) {
		case FundingNoticeKind.RUNWAY_WARNING:
			return {
				subject: `${organizationName}: ${RUNWAY_HEADING[notice.warning].toLowerCase()}`,
				heading: RUNWAY_HEADING[notice.warning],
				paragraphs: [
					`At $${MicroUsd.parse(notice.burnMicroUsdPerHour).toUsd()} an hour, the balance of ${organizationName} lasts about ${duration(BigInt(notice.runwaySeconds))}.`,
					'When it runs out, every sandbox stops and is archived.',
				],
				note: DEPOSIT_NOTE,
				action: ADD_FUNDS,
			};
		case FundingNoticeKind.COMPUTE_STOPPED:
			return {
				subject: `${organizationName}: sandboxes stopped, balance used up`,
				heading: 'Your sandboxes were stopped',
				paragraphs: [
					`The balance of ${organizationName} ran out, so its sandboxes were stopped and archived.`,
					`Its archives, snapshots and volumes are kept until ${formatDate(notice.archivesDeleteAt)}, then deleted.`,
				],
				note: 'Deposit before then to restore your sandboxes.',
				action: ADD_FUNDS,
			};
		case FundingNoticeKind.ARCHIVE_DELETION_SCHEDULED:
			return {
				subject: `${organizationName}: stored data is deleted in a day`,
				heading: 'Your archives, snapshots and volumes are deleted soon',
				paragraphs: [
					`The archived sandboxes, snapshots and volumes of ${organizationName} are deleted at ${formatDate(notice.archivesDeleteAt)}, since the balance is still used up.`,
				],
				note: 'Deposit before then to keep them.',
				action: ADD_FUNDS,
			};
		case FundingNoticeKind.AUTO_TOP_UP_FAILED:
			return {
				subject: `${organizationName}: auto top-up failed`,
				heading: 'An auto top-up failed',
				paragraphs: [
					`Snapflow could not add $${MicroUsd.parse(notice.amountMicroUsd).toUsd()} to the balance of ${organizationName}: ${notice.reason}.`,
					'Check the USDC balance and allowance of the funding wallet.',
				],
				note: DEPOSIT_NOTE,
				action: { ...ADD_FUNDS, label: 'Check auto top-up' },
			};
		case FundingNoticeKind.SIGNER_EXPIRING:
			return {
				subject: `${organizationName}: automatic payments end soon`,
				heading: 'Automatic payments end soon',
				paragraphs: [
					`Automatic payments for ${organizationName} stop on ${formatDate(notice.expiresAt)}.`,
					'Sandboxes need them to keep running.',
				],
				note: AUTO_PAY_NOTE,
				action: { ...ENABLE_AUTO_PAY, label: 'Renew automatic payments' },
			};
		case FundingNoticeKind.SIGNER_EXPIRED:
			return {
				subject: `${organizationName}: automatic payments expired`,
				heading: 'Automatic payments expired',
				paragraphs: [
					`Automatic payments for ${organizationName} expired on ${formatDate(notice.expiresAt)}.`,
					'Sandboxes need them to keep running.',
				],
				note: AUTO_PAY_NOTE,
				action: ENABLE_AUTO_PAY,
			};
		case FundingNoticeKind.SIGNER_REVOKED:
			return {
				subject: `${organizationName}: automatic payments turned off`,
				heading: 'Automatic payments were turned off',
				paragraphs: [
					`The automatic payment key of ${organizationName} was revoked.`,
					'Sandboxes need automatic payments to keep running.',
				],
				note: AUTO_PAY_NOTE,
				action: ENABLE_AUTO_PAY,
			};
		case FundingNoticeKind.SANDBOX_PAUSED_FOR_PAYMENT:
			return {
				subject: `${organizationName}: sandbox ${notice.sandboxName} paused for payment`,
				heading: `Sandbox ${notice.sandboxName} was paused`,
				paragraphs: [
					`Snapflow paused ${notice.sandboxName} because ${notice.reason ? PAYMENT_HOLD_CAUSE[notice.reason] : PAYMENT_HOLD_CATCHING_UP}.`,
					'Its host is not paid while vouchers do not cover it, so the sandbox stays paused until they do.',
				],
				note: 'It resumes on its own once payments cover it again.',
				action: notice.reason
					? PAYMENT_HOLD_FIX[notice.reason]
					: ENABLE_AUTO_PAY,
			};
	}
}
