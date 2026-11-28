/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MicroUsd } from '../../common/values/micro-usd.value';
import { MachineCheck } from '../../machine/constants/machine-check.constants';
import {
	MACHINE_QUALIFICATION_CHECK,
	MACHINE_QUALIFICATION_REASON,
} from '../../machine/constants/machine-qualification.constants';
import { TIER_REASON } from '../../verification/constants/machine-tier.constants';
import { benchmarkFailureGuidance } from '../../verification/utils/benchmark/benchmark-guidance.util';
import {
	DASHBOARD_NOTICE_PATH,
	HostNoticeKind,
} from '../constants/notice.constants';
import type { HostNotice } from '../events/host-notice.event';
import type { NoticeAction, NoticeCopy } from '../types/notice.types';

const MACHINE_CHECK_FAILURE_LABEL: Readonly<Record<string, string>> = {
	[MACHINE_QUALIFICATION_CHECK.RUNTIME_HEALTH]: 'Runtime health',
	[MACHINE_QUALIFICATION_CHECK.STORAGE_IO]: 'Storage I/O',
	[MACHINE_QUALIFICATION_CHECK.CPU_BOUNDED_WORK]: 'CPU work',
	[MACHINE_QUALIFICATION_CHECK.MACHINE_IDENTITY]: 'Machine identity',
	[MACHINE_QUALIFICATION_CHECK.CANARY_MICROVM]: 'Canary microVM',
	[MACHINE_QUALIFICATION_REASON.MALFORMED_EVIDENCE]: 'Readable check results',
	[MACHINE_QUALIFICATION_REASON.REPLAYED]: 'Fresh check results',
	[MACHINE_QUALIFICATION_REASON.WRONG_KEY]: 'Machine key',
	[MACHINE_QUALIFICATION_REASON.WRONG_POLICY]: 'Current check policy',
	[MACHINE_QUALIFICATION_REASON.WRONG_ENVIRONMENT]: 'Unchanged environment',
	[MACHINE_QUALIFICATION_REASON.SIGNATURE_INVALID]: 'Signed check results',
	[MACHINE_QUALIFICATION_REASON.CHECK_FAILED]: 'Functional checks',
	[TIER_REASON.BENCHMARK_MISSING]: 'Passing benchmark',
	[TIER_REASON.BENCHMARK_EXPIRED]: 'Current benchmark',
	[TIER_REASON.INVENTORY_CHANGED]: 'Unchanged hardware since the benchmark',
	[TIER_REASON.FINGERPRINT_CONFLICT]: 'Unique machine fingerprint',
	[TIER_REASON.NETWORK_BELOW_MINIMUM]: 'Minimum network speed',
	[TIER_REASON.DISK_BELOW_MINIMUM]: 'Minimum disk speed',
	[TIER_REASON.RESTRICTED]: 'No restriction',
	[TIER_REASON.UPTIME]: 'Minimum uptime',
	[TIER_REASON.SPOT_CHECKS_MISSING]: 'Enough passed spot checks',
	[TIER_REASON.SPOT_CHECK_FAILED]: 'No failed spot checks',
};

const MACHINE_CHECK_COPY = {
	[MachineCheck.QUALIFICATION]: {
		failed: 'failed qualification',
		consequence:
			'Snapflow runs the checks again later. Until it passes, it may get no new sandboxes.',
	},
	[MachineCheck.TIER]: {
		failed: 'lost its tier',
		consequence: 'It is listed at a lower tier until the requirements are met.',
	},
	[MachineCheck.BENCHMARK]: {
		failed: 'failed its benchmark',
		consequence:
			'Snapflow does not retry it automatically. Fix the problem, then run the benchmark again from the listing page.',
	},
} as const satisfies Record<
	MachineCheck,
	{ failed: string; consequence: string }
>;

function failureLabel(check: MachineCheck, failure: string): string {
	if (check === MachineCheck.BENCHMARK) {
		return benchmarkFailureGuidance(failure).summary;
	}
	return MACHINE_CHECK_FAILURE_LABEL[failure] ?? failure;
}

const BASIS_POINTS_PER_PERCENT = 100;

const VIEW_PAYOUTS: NoticeAction = {
	label: 'View payouts',
	path: DASHBOARD_NOTICE_PATH.EARNINGS_PAYOUTS,
};

function checkMachine(machineId: string): NoticeAction {
	return {
		label: 'Check machine',
		path: `${DASHBOARD_NOTICE_PATH.MACHINES}/${encodeURIComponent(machineId)}${DASHBOARD_NOTICE_PATH.MACHINE_HEALTH}`,
	};
}

function viewListing(machineId: string): NoticeAction {
	return {
		label: 'Review the price',
		path: `${DASHBOARD_NOTICE_PATH.HOST_LISTINGS}/${encodeURIComponent(machineId)}`,
	};
}

export function hostNoticeCopy(
	organizationName: string,
	notice: HostNotice
): NoticeCopy {
	switch (notice.kind) {
		case HostNoticeKind.PAYOUT_SENT:
			return {
				subject: `${organizationName}: payout sent`,
				heading: 'Payout sent',
				paragraphs: [
					`Snapflow paid out the earnings of ${organizationName} to ${notice.payoutAddress}.`,
					...(notice.transactionHash
						? [`Transaction: ${notice.transactionHash}`]
						: []),
				],
				note: 'The payout history shows the amounts.',
				action: VIEW_PAYOUTS,
			};
		case HostNoticeKind.PAYOUT_WALLET_MISSING:
			return {
				subject: `${organizationName}: payouts on hold`,
				heading: 'Payouts are on hold',
				paragraphs: [
					`${organizationName} has earnings waiting, but no payout wallet that can receive them.`,
				],
				note: 'Link a payout wallet to get paid.',
				action: { ...VIEW_PAYOUTS, label: 'Link payout wallet' },
			};
		case HostNoticeKind.PAYOUT_WALLET_CHANGED:
			return {
				subject: `${organizationName}: payout wallet changed`,
				heading: 'Payout wallet changed',
				paragraphs: [
					`Your payout wallet changed to ${notice.payoutAddress}. If this wasn't you, unlink it now.`,
				],
				note: `Payouts of ${organizationName} go to the new wallet from now on.`,
				action: { ...VIEW_PAYOUTS, label: 'Review payout wallet' },
			};
		case HostNoticeKind.MACHINE_OFFLINE:
			return {
				subject: `${notice.machineName} is offline`,
				heading: `${notice.machineName} is offline`,
				paragraphs: [
					`Snapflow has not heard from ${notice.machineName} for a while, so no new sandboxes are placed on it.`,
				],
				note: 'Check that the machine is on and Snapflow is running.',
				action: checkMachine(notice.machineId),
			};
		case HostNoticeKind.MACHINE_FAILED:
			return {
				subject: `${notice.machineName} failed its checks`,
				heading: `${notice.machineName} failed its checks`,
				paragraphs: [
					notice.reason
						? `${notice.machineName} reported that it is not ready: ${notice.reason}`
						: `${notice.machineName} reported that it is not ready.`,
				],
				note: 'No sandboxes are placed on it until it passes.',
				action: checkMachine(notice.machineId),
			};
		case HostNoticeKind.MACHINE_IDLE:
			return {
				subject: `${notice.machineName} was rarely rented this week`,
				heading: `${notice.machineName} was rarely rented this week`,
				paragraphs: [
					`${notice.machineName} was rented ${(notice.utilizationBasisPoints / BASIS_POINTS_PER_PERCENT).toFixed(1)}% of the time over the last 7 days.`,
					notice.marketMedianRateMicroUsd
						? `It asks $${MicroUsd.parse(notice.currentRateMicroUsd).toUsd()} per ${notice.rateUnit}; comparable public machines ask a median of $${MicroUsd.parse(notice.marketMedianRateMicroUsd).toUsd()}.`
						: `It asks $${MicroUsd.parse(notice.currentRateMicroUsd).toUsd()} per ${notice.rateUnit}; no comparable public machine has a price yet.`,
				],
				note: 'Your rates are yours to set. The Pricing page shows what comparable machines ask and what each sandbox size earns.',
				action: viewListing(notice.machineId),
			};
		case HostNoticeKind.MACHINE_CHECK_FAILED: {
			const copy = MACHINE_CHECK_COPY[notice.check];
			return {
				subject: `${notice.machineName} ${copy.failed}`,
				heading: `${notice.machineName} ${copy.failed}`,
				paragraphs: [
					`${notice.machineName} did not meet these requirements: ${notice.failures.map((failure) => failureLabel(notice.check, failure)).join(', ')}.`,
					copy.consequence,
				],
				note: 'The health page shows what to fix.',
				action: checkMachine(notice.machineId),
			};
		}
	}
}
