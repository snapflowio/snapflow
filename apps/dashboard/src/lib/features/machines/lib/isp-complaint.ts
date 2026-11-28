/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateIspComplaint,
	type IspComplaint,
	type IspComplaintDetails,
	IspComplaintOutcome,
} from '@snapflow/api-client';
import * as z from 'zod';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import {
	MAX_TCP_PORT,
	MIN_TCP_PORT,
} from '#lib/features/sandboxes/lib/sandbox-port-preview.ts';
import { formatDateTime } from '#lib/utils/format.ts';

type IspComplaintProtocol = CreateIspComplaint['protocol'];

const PROTOCOL_LABEL = {
	tcp: 'TCP',
	udp: 'UDP',
	icmp: 'ICMP',
} as const satisfies Record<IspComplaintProtocol, string>;

const PROTOCOLS = Object.keys(PROTOCOL_LABEL) as [
	IspComplaintProtocol,
	...IspComplaintProtocol[],
];

export const ISP_PROTOCOL_OPTIONS: readonly ChipOption<IspComplaintProtocol>[] =
	PROTOCOLS.map((value) => ({ value, label: PROTOCOL_LABEL[value] }));

export const ISP_OUTCOME_COPY = {
	[IspComplaintOutcome.NotSnapflow]: {
		label: 'Not a customer workload',
		variant: 'success',
		description:
			'No sandbox or image build on this machine made a matching connection in that window. The statement says the traffic did not come from a Snapflow customer workload and names no customer.',
	},
	[IspComplaintOutcome.Attributed]: {
		label: 'Attributed',
		variant: 'warning',
		description:
			'One sandbox matched. Snapflow is acting on it; the statement confirms the traffic came from a customer workload without naming the customer.',
	},
	[IspComplaintOutcome.ManualReview]: {
		label: 'Manual review',
		variant: 'neutral',
		description:
			'Several workloads or an image build matched, so Snapflow reviews the complaint by hand. The statement names no customer.',
	},
	[IspComplaintOutcome.RecordsIncomplete]: {
		label: 'Records incomplete',
		variant: 'neutral',
		description:
			"Snapflow's connection records do not fully cover that window, so no conclusion can be drawn from them. Snapflow reviews the complaint by hand; the statement says no conclusion can be drawn and names no customer.",
	},
} as const satisfies Record<
	IspComplaintOutcome,
	{ label: string; variant: string; description: string }
>;

const PENDING_OUTCOME = {
	label: 'Matching',
	variant: 'neutral',
	description: 'Snapflow is still matching this complaint.',
} as const;

export function ispOutcomeCopy(complaint: IspComplaint) {
	return complaint.ispOutcome
		? ISP_OUTCOME_COPY[complaint.ispOutcome]
		: PENDING_OUTCOME;
}

const UNKNOWN_DETAIL = 'Not recorded';
const PORT_SEPARATOR = ':';
const WINDOW_SEPARATOR = ' – ';

export function ispDestinationLabel(details: IspComplaintDetails | null) {
	if (!details) return UNKNOWN_DETAIL;
	return details.destinationPort === undefined
		? details.destinationAddress
		: `${details.destinationAddress}${PORT_SEPARATOR}${details.destinationPort}`;
}

export function ispProtocolLabel(details: IspComplaintDetails | null) {
	return details ? PROTOCOL_LABEL[details.protocol] : UNKNOWN_DETAIL;
}

export function ispWindowLabel(details: IspComplaintDetails | null) {
	if (!details) return UNKNOWN_DETAIL;
	return `${formatDateTime(details.observedFrom)}${WINDOW_SEPARATOR}${formatDateTime(details.observedUntil)}`;
}

const DIGITS_ONLY = /^\d+$/;
const MAXIMUM_COMPLAINT_LENGTH = 10_000;

const dateTimeField = (message: string) =>
	z
		.string()
		.min(1, message)
		.refine((value) => !Number.isNaN(Date.parse(value)), message);

export const ispComplaintSchema = z
	.object({
		sourceAddress: z.ipv4(
			'Enter the public IPv4 address named in the complaint'
		),
		destinationAddress: z.ipv4('Enter the IPv4 address the traffic went to'),
		destinationPort: z
			.string()
			.trim()
			.refine(
				(value) =>
					value === '' ||
					(DIGITS_ONLY.test(value) &&
						Number(value) >= MIN_TCP_PORT &&
						Number(value) <= MAX_TCP_PORT),
				`Enter a port from ${MIN_TCP_PORT} to ${MAX_TCP_PORT}, or leave it empty`
			),
		protocol: z.enum(PROTOCOLS),
		observedFrom: dateTimeField('Enter when the reported traffic started'),
		observedUntil: dateTimeField('Enter when the reported traffic ended'),
		complaintText: z
			.string()
			.trim()
			.min(1, 'Paste the complaint your ISP sent')
			.max(MAXIMUM_COMPLAINT_LENGTH),
	})
	.refine(
		(value) => Date.parse(value.observedUntil) > Date.parse(value.observedFrom),
		{
			path: ['observedUntil'],
			message: 'The end must be after the start',
		}
	);

export type IspComplaintFormValues = z.input<typeof ispComplaintSchema>;

export const ISP_COMPLAINT_DEFAULTS: IspComplaintFormValues = {
	sourceAddress: '',
	destinationAddress: '',
	destinationPort: '',
	protocol: 'tcp',
	observedFrom: '',
	observedUntil: '',
	complaintText: '',
};

export const ISP_COMPLAINT_TEXT_ROWS = 6;

export function toCreateIspComplaint(
	values: z.output<typeof ispComplaintSchema>
): CreateIspComplaint {
	return {
		sourceAddress: values.sourceAddress,
		destinationAddress: values.destinationAddress,
		destinationPort:
			values.destinationPort === ''
				? undefined
				: Number(values.destinationPort),
		protocol: values.protocol,
		observedFrom: new Date(values.observedFrom).toISOString(),
		observedUntil: new Date(values.observedUntil).toISOString(),
		complaintText: values.complaintText,
	};
}

const OUTCOME_RING = {
	success: { shape: 'check', tone: 'success' },
	warning: { shape: 'alert', tone: 'warning' },
	neutral: { shape: 'half', tone: 'neutral' },
} as const;

export function ispOutcomeStatus(complaint: IspComplaint) {
	const outcome = ispOutcomeCopy(complaint);
	return {
		label: outcome.label,
		...OUTCOME_RING[outcome.variant],
		live: complaint.ispOutcome === null,
		description: null,
	};
}
