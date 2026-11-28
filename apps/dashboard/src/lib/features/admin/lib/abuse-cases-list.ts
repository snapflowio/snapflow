/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AbuseCase,
	AbuseCaseStatus,
	type AbuseFinding,
	AbuseSignalKind,
	AbuseSignalSeverity,
} from '@snapflow/api-client';
import * as z from 'zod';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import {
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { titleCase } from '#lib/utils/text.ts';

const ABUSE_SIGNAL_LABEL = {
	[AbuseSignalKind.MiningPoolDns]: 'Mining pool lookup',
	[AbuseSignalKind.MiningPoolConnection]: 'Mining pool connection',
	[AbuseSignalKind.StratumHandshake]: 'Mining handshake',
	[AbuseSignalKind.MiningProfile]: 'Mining traffic pattern',
	[AbuseSignalKind.HorizontalScan]: 'Address scan',
	[AbuseSignalKind.VerticalScan]: 'Port scan',
	[AbuseSignalKind.FailedConnections]: 'Failing connections',
	[AbuseSignalKind.BruteForce]: 'Login brute force',
	[AbuseSignalKind.SmtpAttempts]: 'Direct mail',
	[AbuseSignalKind.ConnectionFlood]: 'Connection flood',
	[AbuseSignalKind.PacketFlood]: 'Packet flood',
	[AbuseSignalKind.ReflectionAttempts]: 'Reflection traffic',
	[AbuseSignalKind.ProxyRelay]: 'Proxy relay',
} as const satisfies Record<AbuseSignalKind, string>;

const HARD_SIGNAL_SUFFIX = ' (hard)';
const FINDING_SEPARATOR = ', ';
const MANUAL_CASE_LABEL = 'Manual';
const DETECTOR_CASE_LABEL = 'Detector';

export function findingLabel(finding: AbuseFinding): string {
	const label = `${ABUSE_SIGNAL_LABEL[finding.kind]} ×${finding.count}`;
	return finding.severity === AbuseSignalSeverity.Hard
		? `${label}${HARD_SIGNAL_SUFFIX}`
		: label;
}

export function findingsSummary(abuseCase: AbuseCase): string {
	return abuseCase.findings.map(findingLabel).join(FINDING_SEPARATOR);
}

export function abuseCaseOpenedBy(abuseCase: AbuseCase): string {
	return abuseCase.manual ? MANUAL_CASE_LABEL : DETECTOR_CASE_LABEL;
}

export function isOpenCase(abuseCase: AbuseCase): boolean {
	return abuseCase.status !== AbuseCaseStatus.Resolved;
}

export const ABUSE_CASE_SORT_OPTIONS = [
	{ id: 'lastSeen', label: 'Last seen' },
	{ id: 'firstSeen', label: 'First seen' },
] as const;

export const ABUSE_CASE_STATUS_OPTIONS = Object.values(AbuseCaseStatus).map(
	(status) => ({ label: titleCase(status), value: status })
);

export const ABUSE_CASE_FILTER_KEYS = ['status'] as const;

export const abuseCasesSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['lastSeen', 'firstSeen']),
	status: searchParamArray(z.enum(AbuseCaseStatus)).catch([]),
});

export function resolveAbuseCaseCopy(
	abuseCase: AbuseCase | null
): ChipConfirmCopy {
	return {
		title: 'Resolve abuse case',
		text: [
			'Resolve the case of sandbox ',
			{ text: abuseCase?.sandboxId ?? 'this sandbox', bold: true },
			'? ',
			{
				text: 'Its throttle is released and the abuse suspension of its organization is lifted.',
				error: true,
			},
		],
		confirmLabel: 'Resolve',
	};
}
