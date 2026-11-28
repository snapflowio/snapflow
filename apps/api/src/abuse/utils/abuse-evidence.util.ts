/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Machine } from '../../machine/entities/machine.entity';
import type { Organization } from '../../organization/entities/organization.entity';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { AbuseEvidenceKind } from '../constants/abuse-report.constants';
import type { SandboxConnectionRecord } from '../entities/sandbox-connection-record.entity';

export type EvidenceSandbox = Pick<
	Sandbox,
	| 'id'
	| 'name'
	| 'organizationId'
	| 'machineId'
	| 'snapshot'
	| 'state'
	| 'createdAt'
>;

export function sandboxSnapshotPayload(
	sandbox: EvidenceSandbox,
	organization: Pick<Organization, 'id' | 'name'> | null,
	machine: Pick<Machine, 'id' | 'name' | 'organizationId' | 'country'> | null
) {
	return {
		kind: AbuseEvidenceKind.SANDBOX_SNAPSHOT,
		sandbox: {
			id: sandbox.id,
			name: sandbox.name,
			snapshot: sandbox.snapshot ?? null,
			state: sandbox.state,
			createdAt: sandbox.createdAt.toISOString(),
		},
		organization: organization
			? { id: organization.id, name: organization.name }
			: { id: sandbox.organizationId, name: null },
		machine: machine
			? {
					id: machine.id,
					name: machine.name,
					hostOrganizationId: machine.organizationId,
					country: machine.country ?? null,
				}
			: null,
	};
}

export function connectionRecordsPayload(
	records: readonly SandboxConnectionRecord[],
	truncated: boolean
) {
	return {
		kind: AbuseEvidenceKind.CONNECTION_RECORDS,
		truncated,
		records: records.map((record) => ({
			destinationAddress: record.destinationAddress,
			destinationPort: record.destinationPort,
			protocol: record.protocol,
			firstSeenAt: record.firstSeenAt.toISOString(),
			lastSeenAt: record.lastSeenAt.toISOString(),
		})),
	};
}

export function previewCapturePayload(
	url: string,
	capture:
		| {
				status: number;
				finalUrl: string;
				headers: Record<string, string>;
				body: string | null;
				truncated: boolean;
		  }
		| { error: string }
) {
	return { kind: AbuseEvidenceKind.PREVIEW_CAPTURE, url, ...capture };
}

export type AbuseEvidencePayload =
	| ReturnType<typeof sandboxSnapshotPayload>
	| ReturnType<typeof connectionRecordsPayload>
	| ReturnType<typeof previewCapturePayload>;
