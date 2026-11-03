/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BillingEvidenceCountsDto } from '@snapflow/api-client';

interface BillingEvidencePresentation {
	label: string;
	description: string;
}

const BILLING_EVIDENCE_PRESENTATION = {
	pending: {
		label: 'Verifying',
		description:
			'Waiting for independent usage evidence. The charge is posted once the evidence matches.',
	},
	corroborated: {
		label: 'Verified',
		description: 'Independent usage evidence matches this charge.',
	},
} as const satisfies Partial<
	Record<keyof BillingEvidenceCountsDto, BillingEvidencePresentation>
>;

type BillingEvidenceStatus = keyof typeof BILLING_EVIDENCE_PRESENTATION;

const PENDING_EVIDENCE_STATUS = 'pending' satisfies BillingEvidenceStatus;

export const BILLING_EVIDENCE_PENDING_LABEL =
	BILLING_EVIDENCE_PRESENTATION[PENDING_EVIDENCE_STATUS].label;

export function isPendingEvidence(status: string): boolean {
	return status === PENDING_EVIDENCE_STATUS;
}

const UNKNOWN_EVIDENCE_PRESENTATION: BillingEvidencePresentation = {
	label: 'Unknown',
	description:
		'Snapflow returned an evidence state this dashboard does not recognize.',
};

function isBillingEvidenceStatus(
	value: string
): value is BillingEvidenceStatus {
	return Object.hasOwn(BILLING_EVIDENCE_PRESENTATION, value);
}

export function billingEvidencePresentation(
	status: string
): BillingEvidencePresentation {
	return isBillingEvidenceStatus(status)
		? BILLING_EVIDENCE_PRESENTATION[status]
		: UNKNOWN_EVIDENCE_PRESENTATION;
}

const REASON_CODE_WORD_SEPARATOR = /_/g;

export function formatReconciliationReason(reason: string): string {
	const text = reason.trim().replace(REASON_CODE_WORD_SEPARATOR, ' ');
	return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}
