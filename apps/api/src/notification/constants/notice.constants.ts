/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CronExpression } from '@nestjs/schedule';
import {
	ORGANIZATION_PRESET_ROLE,
	ORGANIZATION_ROLE,
} from '@snapflow/organization-access';
import {
	SECONDS_PER_DAY,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { LIMITS_PAGE_PATH } from '../../organization/constants/organization-quota-tier.constants';

export const HostNoticeEvents = {
	NOTICE: 'host.notice',
	MACHINE_CHECK: 'host.notice.machine-check',
} as const;

export const HostNoticeKind = {
	PAYOUT_SENT: 'payout_sent',
	PAYOUT_WALLET_MISSING: 'payout_wallet_missing',
	PAYOUT_WALLET_CHANGED: 'payout_wallet_changed',
	MACHINE_OFFLINE: 'machine_offline',
	MACHINE_FAILED: 'machine_failed',
	MACHINE_CHECK_FAILED: 'machine_check_failed',
	MACHINE_IDLE: 'machine_idle',
} as const;

export type HostNoticeKind =
	(typeof HostNoticeKind)[keyof typeof HostNoticeKind];

export const AbuseNoticeEvents = {
	NOTICE: 'abuse.notice',
	FORWARD_COUNTER_NOTICE: 'abuse.counter-notice.forward',
} as const;

export const SandboxNoticeEvents = {
	MACHINE_UNAVAILABLE_CHECK: 'sandbox.notice.machine-unavailable-check',
} as const;

export const AbuseNoticeKind = {
	CASE_OPENED: 'case_opened',
	THROTTLED: 'throttled',
	SUSPENDED: 'suspended',
	PREVIEW_DISABLED: 'preview_disabled',
	EGRESS_BLOCKED: 'egress_blocked',
	PAUSED: 'paused',
	TERMINATED: 'terminated',
	RESOLVED: 'resolved',
} as const;

export type AbuseNoticeKind =
	(typeof AbuseNoticeKind)[keyof typeof AbuseNoticeKind];

export const AbuseNoticeAudience = {
	CUSTOMER: 'customer',
	HOST: 'host',
} as const;

export type AbuseNoticeAudience =
	(typeof AbuseNoticeAudience)[keyof typeof AbuseNoticeAudience];

export const HOST_ONLY_ABUSE_NOTICE_KINDS: ReadonlySet<AbuseNoticeKind> =
	new Set([AbuseNoticeKind.CASE_OPENED]);

export const MACHINE_NOTICE_KIND = {
	[MachineState.UNRESPONSIVE]: HostNoticeKind.MACHINE_OFFLINE,
	[MachineState.FAILED]: HostNoticeKind.MACHINE_FAILED,
} as const;

export type NoticedMachineState = keyof typeof MACHINE_NOTICE_KIND;

export const NOTICE_RECIPIENT_ROLES = {
	CUSTOMER: [
		ORGANIZATION_ROLE.OWNER,
		ORGANIZATION_ROLE.ADMIN,
		ORGANIZATION_PRESET_ROLE.BILLING_ADMIN,
	],
	HOST: [ORGANIZATION_ROLE.OWNER],
	PAYOUTS: [
		ORGANIZATION_ROLE.OWNER,
		ORGANIZATION_ROLE.ADMIN,
		ORGANIZATION_PRESET_ROLE.BILLING_ADMIN,
	],
	API_KEY: [ORGANIZATION_ROLE.OWNER, ORGANIZATION_ROLE.ADMIN],
	LIMITS_TIER: [ORGANIZATION_ROLE.OWNER, ORGANIZATION_ROLE.ADMIN],
	LIMITS_DECISION: [ORGANIZATION_ROLE.OWNER],
	ABUSE: [ORGANIZATION_ROLE.OWNER],
	SANDBOX: [ORGANIZATION_ROLE.OWNER, ORGANIZATION_ROLE.ADMIN],
} as const;

export const HOST_NOTICE_RECIPIENT_ROLES: Readonly<
	Partial<Record<HostNoticeKind, readonly string[]>>
> = {
	[HostNoticeKind.PAYOUT_WALLET_CHANGED]: NOTICE_RECIPIENT_ROLES.PAYOUTS,
};

const PAYOUT_WALLET_REMINDER_DAYS = 7;
const SIGNER_EXPIRY_WARNING_DAYS = 7;
const MACHINE_NOTICE_GRACE_MINUTES = 10;
const PAYMENT_HOLD_NOTICE_COOLDOWN_HOURS = 1;

export const NOTICE_COOLDOWN_SECONDS = {
	payoutWalletMissing: PAYOUT_WALLET_REMINDER_DAYS * SECONDS_PER_DAY,
	machine: SECONDS_PER_DAY,
	paymentHold: PAYMENT_HOLD_NOTICE_COOLDOWN_HOURS * SECONDS_PER_HOUR,
	storageCap: SECONDS_PER_DAY,
	machineIdle: 7 * SECONDS_PER_DAY,
} as const;

export const MACHINE_NOTICE_GRACE_SECONDS =
	MACHINE_NOTICE_GRACE_MINUTES * SECONDS_PER_MINUTE;

export const SANDBOX_NOTICE_BATCH_SECONDS = SECONDS_PER_MINUTE;

export const SIGNER_NOTICE_SCAN = {
	expiringWithinSeconds: SIGNER_EXPIRY_WARNING_DAYS * SECONDS_PER_DAY,
	expression: CronExpression.EVERY_HOUR,
	jobName: 'scan-signer-notices',
} as const;

export const NOTICE_KEY_SEPARATOR = ':';

export const NOTICE_KEY_LIST_SEPARATOR = ',';

export const DASHBOARD_NOTICE_PATH = {
	API_KEYS: '/settings/api-keys',
	BILLING_FUNDING: '/billing/funding',
	EARNINGS_PAYOUTS: '/earnings',
	MACHINES: '/machines',
	SANDBOXES: '/sandboxes',
	ABUSE_APPEALS: '/abuse-appeals',
	MACHINE_HEALTH: '/health',
	HOST_LISTINGS: '/listings/mine',
	SETTINGS_LIMITS: LIMITS_PAGE_PATH,
} as const;

export const ENABLE_AUTO_PAY_SEARCH = { open: 'automatic-payments' } as const;

export const RAISE_SIGNER_LIMIT_SEARCH = { open: 'signer-limit' } as const;
