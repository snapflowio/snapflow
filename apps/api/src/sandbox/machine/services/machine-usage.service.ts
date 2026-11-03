/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, Injectable } from '@nestjs/common';
import { MACHINE_USAGE_PLACEMENT_LOCK_NAMESPACE } from '../../../common/constants/advisory-lock.constants';
import type { CursorPage } from '../../../common/dto/cursor-page.dto';
import {
	decodeTimestampIdCursor,
	encodeTimestampIdCursor,
} from '../../../common/utils/pagination/timestamp-id-cursor.util';
import { millisecondsBetween } from '../../../common/utils/time.util';
import {
	databaseNow,
	parseDatabaseTimestamp,
} from '../../../infra/database/utils/database-time.util';
import {
	type VerifiedMachineUsageReceipt,
	verifyMachineUsageReceipt,
} from '../../../usage/metering/utils/evidence/machine-usage-evidence.util';
import { machineUsagePayloadDigest } from '../../../usage/metering/utils/evidence/machine-usage-signature.util';
import { Sandbox } from '../../instance/entities/sandbox.entity';
import { SandboxPlacement } from '../../instance/entities/sandbox-placement.entity';
import {
	MACHINE_USAGE_GENESIS_DIGEST,
	MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS,
} from '../constants/machine-usage.constants';
import type {
	AcceptedMachineUsageReceiptDto,
	MachineReportablePlacementDto,
	MachineUsageReceiptDto,
} from '../dto/machine-usage.dto';
import { Machine } from '../entities/machine.entity';
import { MachineSession } from '../entities/machine-session.entity';
import { MachineUsageReceipt } from '../entities/machine-usage-receipt.entity';
import { MachineUsageEvidenceError } from '../exceptions/machine-usage-evidence.exception';
import {
	clampNetworkDeltas,
	type NetworkLinkLimits,
	networkLinkLimits,
} from '../utils/usage/machine-network-clamp.util';
import { assertMachineUsageClock } from '../utils/usage/machine-usage-clock.util';
import { machineUsageReceipt } from '../utils/usage/machine-usage-receipt.util';
import { MachineSessionService } from './machine-session.service';

@Injectable()
export class MachineUsageService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineSessionService: MachineSessionService
	) {}

	async listReportablePlacements(
		machineId: string,
		limit: number,
		cursor?: string
	): Promise<CursorPage<MachineReportablePlacementDto>> {
		const decodedCursor = cursor
			? decodeTimestampIdCursor(cursor, 'Machine usage placement')
			: null;
		const cursorPredicate = decodedCursor
			? 'AND (placement."placedAt" > ? OR (placement."placedAt" = ? AND placement.id > ?))'
			: '';
		const parameters: unknown[] = [
			machineId,
			MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS,
		];
		if (decodedCursor) {
			parameters.push(
				decodedCursor.timestamp,
				decodedCursor.timestamp,
				decodedCursor.id
			);
		}
		parameters.push(limit + 1);
		const placements = await this.entityManager.execute<
			{
				placementId: string;
				sandboxId: string;
				assignmentGeneration: number;
				fencingToken: string;
				placedAt: unknown;
				releasedAt: unknown;
			}[]
		>(
			`SELECT
				placement.id AS "placementId",
				placement."sandboxId" AS "sandboxId",
				placement."assignmentGeneration" AS "assignmentGeneration",
				placement."fencingToken" AS "fencingToken",
				placement."placedAt" AS "placedAt",
				placement."releasedAt" AS "releasedAt"
			FROM "sandbox_placement" placement
			INNER JOIN "sandbox" sandbox ON sandbox.id = placement."sandboxId"
			WHERE placement."machineId" = ?
				AND (
					(placement."releasedAt" IS NULL AND sandbox.pending = false)
					OR placement."releasedAt" > transaction_timestamp() - (? * interval '1 millisecond')
				)
			${cursorPredicate}
			ORDER BY placement."placedAt" ASC, placement.id ASC
			LIMIT ?`,
			parameters
		);
		const hasNextPage = placements.length > limit;
		const page = hasNextPage ? placements.slice(0, limit) : placements;
		const items = page.map((placement) => ({
			placementId: placement.placementId,
			sandboxId: placement.sandboxId,
			assignmentGeneration: placement.assignmentGeneration,
			fencingToken: placement.fencingToken,
			placedAt: parseDatabaseTimestamp(placement.placedAt).toISOString(),
			releasedAt:
				placement.releasedAt === null || placement.releasedAt === undefined
					? null
					: parseDatabaseTimestamp(placement.releasedAt).toISOString(),
		}));
		const lastPlacement = page.at(-1);
		return {
			items,
			nextCursor:
				hasNextPage && lastPlacement
					? encodeTimestampIdCursor({
							timestamp: parseDatabaseTimestamp(lastPlacement.placedAt),
							id: lastPlacement.placementId,
						})
					: null,
		};
	}

	async record(
		machineId: string,
		session: MachineSession,
		input: MachineUsageReceiptDto
	): Promise<AcceptedMachineUsageReceiptDto> {
		return this.entityManager.transactional(
			async (manager) => {
				const observedAt = await databaseNow(manager);
				await this.machineSessionService.assertCurrent(
					manager,
					machineId,
					session.id,
					observedAt
				);
				await manager.execute(
					'SELECT pg_advisory_xact_lock(hashtextextended(?, ?))',
					[input.placementId, MACHINE_USAGE_PLACEMENT_LOCK_NAMESPACE]
				);
				const machine = await manager.findOne(Machine, { id: machineId });
				if (!machine?.identityPublicKey) {
					throw new BadRequestException('Machine has no machine identity key');
				}
				const placement = await this.fencedPlacement(manager, machineId, input);
				const existing = await manager.findOne(MachineUsageReceipt, {
					payloadDigest: machineUsagePayloadDigest(machineId, input),
				});
				if (existing) return this.toAccepted(existing);
				const predecessor = await this.predecessor(manager, placement, input);
				const verified = this.verify(
					machineId,
					machine.identityPublicKey,
					placement,
					input,
					predecessor,
					observedAt
				);
				const receipt = machineUsageReceipt({
					machineId,
					sessionId: session.id,
					placement,
					input,
					predecessor,
					verified,
					network: clampNetworkDeltas(
						verified.networkDeltas,
						this.networkWindowMillis(placement, verified),
						await this.linkLimits(manager, machineId, placement.sandboxId)
					),
					signerPublicKey: machine.identityPublicKey,
					receivedAt: observedAt,
				});
				manager.persist(receipt);
				return this.toAccepted(receipt);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async fencedPlacement(
		manager: EntityManager,
		machineId: string,
		input: MachineUsageReceiptDto
	): Promise<SandboxPlacement> {
		const placement = await manager.findOne(
			SandboxPlacement,
			{ id: input.placementId },
			{ lockMode: LockMode.PESSIMISTIC_READ }
		);
		if (
			!placement ||
			placement.machineId !== machineId ||
			placement.sandboxId !== input.sandboxId ||
			placement.assignmentGeneration !== input.assignmentGeneration ||
			placement.fencingToken !== input.fencingToken
		) {
			throw new BadRequestException('Usage receipt placement was fenced');
		}
		return placement;
	}

	private async predecessor(
		manager: EntityManager,
		placement: SandboxPlacement,
		input: MachineUsageReceiptDto
	): Promise<MachineUsageReceipt | null> {
		const head = await manager.findOne(
			MachineUsageReceipt,
			{ placementId: placement.id, generationId: input.generationId },
			{ orderBy: { sequence: 'DESC' } }
		);
		const expected = head?.payloadDigest ?? MACHINE_USAGE_GENESIS_DIGEST;
		if (input.previousDigest !== expected) {
			throw new BadRequestException(
				'Usage receipt does not extend its usage chain'
			);
		}
		if (head) return head;
		const opener = await manager.findOne(
			MachineUsageReceipt,
			{ placementId: placement.id, generationId: { $ne: input.generationId } },
			{ orderBy: { sequence: 'DESC' } }
		);
		return opener && BigInt(opener.sequence) < BigInt(input.sequence)
			? opener
			: null;
	}

	private verify(
		machineId: string,
		signerPublicKey: string,
		placement: SandboxPlacement,
		input: MachineUsageReceiptDto,
		predecessor: MachineUsageReceipt | null,
		observedAt: Date
	): VerifiedMachineUsageReceipt {
		try {
			const verified = verifyMachineUsageReceipt(
				machineId,
				{ signerPublicKey, envelope: { ...input } },
				predecessor && {
					signerPublicKey: predecessor.signerPublicKey,
					envelope: predecessor.envelope,
				}
			);
			assertMachineUsageClock(placement, verified.reading, observedAt);
			return verified;
		} catch (error) {
			if (error instanceof MachineUsageEvidenceError) {
				throw new BadRequestException(error.message);
			}
			throw error;
		}
	}

	private networkWindowMillis(
		placement: SandboxPlacement,
		verified: VerifiedMachineUsageReceipt
	): bigint {
		const startedAt =
			verified.predecessor?.reading.sampledAt ?? placement.placedAt;
		return BigInt(
			Math.max(0, millisecondsBetween(startedAt, verified.reading.sampledAt))
		);
	}

	private async linkLimits(
		manager: EntityManager,
		machineId: string,
		sandboxId: string
	): Promise<NetworkLinkLimits> {
		const [machine, sandbox] = await Promise.all([
			manager.findOne(Machine, { id: machineId }),
			manager.findOne(Sandbox, { id: sandboxId }),
		]);
		return networkLinkLimits(machine, [
			sandbox?.egressBandwidthBps ?? null,
			sandbox?.networkThrottleBandwidthBps ?? null,
		]);
	}

	private toAccepted(
		receipt: MachineUsageReceipt
	): AcceptedMachineUsageReceiptDto {
		return {
			id: receipt.id,
			payloadDigest: receipt.payloadDigest,
			acceptedComputeDeltaMillis: receipt.acceptedComputeDeltaMillis,
			acceptedStorageDeltaMillis: receipt.acceptedStorageDeltaMillis,
			acceptedInternetEgressDeltaBytes:
				receipt.acceptedInternetEgressDeltaBytes,
			acceptedInternetIngressDeltaBytes:
				receipt.acceptedInternetIngressDeltaBytes,
		};
	}
}
