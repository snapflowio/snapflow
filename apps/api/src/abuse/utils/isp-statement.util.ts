/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { IspComplaintOutcome } from '../constants/isp-complaint.constants';
import type { IspComplaintDetailsDto } from '../dto/abuse-report-intake.dto';

const CONCLUSION = {
	[IspComplaintOutcome.NOT_SNAPFLOW]: (destination: string) => [
		'Snapflow records the destination address, port and protocol of every TCP and UDP connection that the customer workloads on this machine open, including image builds, and its records for this machine are complete for the period above.',
		`No customer workload that Snapflow runs on this machine contacted ${destination} in that period. The traffic described in the complaint did not come from a Snapflow customer workload.`,
	],
	[IspComplaintOutcome.ATTRIBUTED]: (destination: string) => [
		`A customer workload that Snapflow runs on this machine contacted ${destination} in the period above.`,
		'Snapflow has opened an abuse case and is acting on it under its acceptable use policy.',
	],
	[IspComplaintOutcome.MANUAL_REVIEW]: (destination: string) => [
		`A customer workload that Snapflow runs on this machine contacted ${destination} in the period above.`,
		'Snapflow is reviewing the complaint and will act on the responsible customer under its acceptable use policy.',
	],
	[IspComplaintOutcome.RECORDS_INCOMPLETE]: () => [
		"Snapflow's connection records for this machine cannot settle this complaint. Snapflow records only TCP and UDP connections, and for the period above its records may be incomplete: the period may be older than Snapflow keeps records, the machine may not have reported for part of it, or the address may not have belonged to the machine for all of it.",
		'No conclusion can be drawn from these records about whether a customer workload that Snapflow runs sent this traffic. Snapflow is reviewing the complaint manually.',
	],
} as const satisfies Record<
	IspComplaintOutcome,
	(destination: string) => readonly string[]
>;

export function ispStatementContent(input: {
	reportId: string;
	machineId: string;
	issuedAt: Date;
	outcome: IspComplaintOutcome;
	complaint: IspComplaintDetailsDto;
}) {
	const { complaint } = input;
	const destination = complaint.destinationPort
		? `${complaint.destinationAddress} port ${complaint.destinationPort} (${complaint.protocol.toUpperCase()})`
		: `${complaint.destinationAddress} (${complaint.protocol.toUpperCase()})`;
	return {
		reference: input.reportId,
		issuedAt: input.issuedAt.toISOString(),
		facts: [
			{ label: 'Machine', value: input.machineId },
			{ label: 'Public address', value: complaint.sourceAddress },
			{ label: 'Destination', value: destination },
			{
				label: 'Period (UTC)',
				value: `${new Date(complaint.observedFrom).toISOString()} to ${new Date(complaint.observedUntil).toISOString()}`,
			},
		],
		conclusion: CONCLUSION[input.outcome](destination),
	};
}

export type IspStatementContent = ReturnType<typeof ispStatementContent>;
