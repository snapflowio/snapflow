/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { SECONDS_PER_DAY } from '../../common/constants/time.constants';
import { errorMessage } from '../../common/utils/error/error.util';
import { addSeconds } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { Machine } from '../../machine/entities/machine.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import {
	ABUSE_EVIDENCE_RETENTION,
	PREVIEW_CAPTURE,
} from '../constants/abuse-report.constants';
import {
	CONNECTION_RECORDS,
	ConnectionWorkloadKind,
} from '../constants/isp-complaint.constants';
import { AbuseEvidence } from '../entities/abuse-evidence.entity';
import { SandboxConnectionRecord } from '../entities/sandbox-connection-record.entity';
import {
	type AbuseEvidencePayload,
	connectionRecordsPayload,
	previewCapturePayload,
	sandboxSnapshotPayload,
} from '../utils/abuse-evidence.util';

const CONNECTION_EVIDENCE_LOOKBACK_SECONDS = SECONDS_PER_DAY;

@Injectable()
export class AbuseEvidenceService {
	constructor(private readonly entityManager: EntityManager) {}

	async capture(
		caseId: string,
		sandboxId: string,
		options: { previewUrl: string | null; restricted: boolean }
	): Promise<void> {
		const manager = this.entityManager.fork();
		const now = await databaseNow(manager);
		const retainUntil = addSeconds(
			now,
			options.restricted
				? ABUSE_EVIDENCE_RETENTION.restrictedSeconds
				: ABUSE_EVIDENCE_RETENTION.standardSeconds
		);
		const payloads: AbuseEvidencePayload[] = [
			await this.sandboxSnapshot(manager, sandboxId),
			await this.connectionRecords(manager, sandboxId, now),
		].filter((payload) => payload !== null);
		if (options.previewUrl && !options.restricted) {
			payloads.push(await capturePreview(options.previewUrl));
		}
		for (const payload of payloads) {
			manager.create(AbuseEvidence, {
				abuseCaseId: caseId,
				kind: payload.kind,
				restricted: options.restricted,
				payload,
				retainUntil,
			});
		}
		await manager.flush();
	}

	private async sandboxSnapshot(manager: EntityManager, sandboxId: string) {
		const sandbox = await manager.findOne(
			Sandbox,
			{ id: sandboxId },
			{
				fields: [
					'id',
					'name',
					'organizationId',
					'machineId',
					'snapshot',
					'state',
					'createdAt',
				],
			}
		);
		if (!sandbox) return null;
		const [organization, machine] = await Promise.all([
			manager.findOne(
				Organization,
				{ id: sandbox.organizationId },
				{ fields: ['id', 'name'] }
			),
			sandbox.machineId
				? manager.findOne(
						Machine,
						{ id: sandbox.machineId },
						{ fields: ['id', 'name', 'organizationId', 'country'] }
					)
				: null,
		]);
		return sandboxSnapshotPayload(sandbox, organization, machine);
	}

	private async connectionRecords(
		manager: EntityManager,
		sandboxId: string,
		now: Date
	) {
		const records = await manager.find(
			SandboxConnectionRecord,
			{
				workloadId: sandboxId,
				workloadKind: ConnectionWorkloadKind.SANDBOX,
				lastSeenAt: {
					$gte: addSeconds(now, -CONNECTION_EVIDENCE_LOOKBACK_SECONDS),
				},
			},
			{
				orderBy: { lastSeenAt: QueryOrder.DESC },
				limit: CONNECTION_RECORDS.maximumPerReport + 1,
			}
		);
		const truncated = records.length > CONNECTION_RECORDS.maximumPerReport;
		return connectionRecordsPayload(
			records.slice(0, CONNECTION_RECORDS.maximumPerReport),
			truncated
		);
	}
}

async function capturePreview(url: string) {
	try {
		const response = await fetch(url, {
			redirect: 'manual',
			headers: { 'user-agent': PREVIEW_CAPTURE.userAgent },
			signal: AbortSignal.timeout(PREVIEW_CAPTURE.timeoutMilliseconds),
		});
		const { body, truncated } = await boundedText(response);
		return previewCapturePayload(url, {
			status: response.status,
			finalUrl: response.url,
			headers: Object.fromEntries(response.headers.entries()),
			body,
			truncated,
		});
	} catch (error) {
		return previewCapturePayload(url, { error: errorMessage(error) });
	}
}

async function boundedText(
	response: Response
): Promise<{ body: string | null; truncated: boolean }> {
	if (!response.body) return { body: null, truncated: false };
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;
	while (received < PREVIEW_CAPTURE.maximumBodyBytes) {
		const { done, value } = await reader.read();
		if (done) {
			return { body: decode(chunks), truncated: false };
		}
		chunks.push(value);
		received += value.byteLength;
	}
	await reader.cancel();
	return { body: decode(chunks), truncated: true };
}

function decode(chunks: readonly Uint8Array[]): string {
	return new TextDecoder().decode(Buffer.concat(chunks));
}
