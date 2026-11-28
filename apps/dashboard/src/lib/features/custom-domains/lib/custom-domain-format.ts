/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CustomDomainState } from '@snapflow/api-client';
import * as z from 'zod';
import type { SandboxCustomDomain } from '#lib/api/sandboxes/custom-domains.ts';
import type { StatusBadge } from '#lib/components/ui/status-badge.ts';
import {
	MAX_TCP_PORT,
	MIN_TCP_PORT,
} from '#lib/features/sandboxes/lib/sandbox-port-preview.ts';
import { formatDateTime } from '#lib/utils/format.ts';

const MINIMUM_HOSTNAME_LENGTH = 4;
const SUMMARY_SEPARATOR = ' · ';

export const CUSTOM_DOMAIN_STATE_BADGE = {
	[CustomDomainState.Pending]: { label: 'Waiting for DNS', variant: 'warning' },
	[CustomDomainState.Validating]: { label: 'Verifying', variant: 'neutral' },
	[CustomDomainState.Active]: { label: 'Active', variant: 'success' },
	[CustomDomainState.Failed]: { label: 'Failed', variant: 'error' },
	[CustomDomainState.Deleting]: { label: 'Removing', variant: 'neutral' },
} as const satisfies Record<CustomDomainState, StatusBadge>;

export const addCustomDomainSchema = z.object({
	port: z.string().refine((value) => {
		const port = Number(value);
		return (
			Number.isInteger(port) && port >= MIN_TCP_PORT && port <= MAX_TCP_PORT
		);
	}, `Port must be between ${MIN_TCP_PORT} and ${MAX_TCP_PORT}`),
	hostname: z
		.string()
		.trim()
		.min(MINIMUM_HOSTNAME_LENGTH, 'Enter a hostname such as app.example.com'),
});

export function customDomainSummary(domain: SandboxCustomDomain): string {
	const parts = [`Port ${domain.port}`];
	if (domain.verificationExpiresAt) {
		parts.push(`Verify by ${formatDateTime(domain.verificationExpiresAt)}`);
	}
	if (domain.lastError) parts.push(domain.lastError);
	return parts.join(SUMMARY_SEPARATOR);
}

export function needsDnsRecords(domain: SandboxCustomDomain): boolean {
	return (
		domain.state === CustomDomainState.Pending ||
		domain.state === CustomDomainState.Validating ||
		domain.state === CustomDomainState.Failed
	);
}
