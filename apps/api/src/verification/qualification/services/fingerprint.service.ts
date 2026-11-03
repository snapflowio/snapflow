/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import { MachineState } from '../../../sandbox/machine/enums/machine-state.enum';
import { MachineFingerprintComponent } from '../entities/machine-fingerprint-component.entity';
import { VerificationReviewKind } from '../enums/verification-review-kind.enum';
import type { FingerprintDigest } from '../utils/inventory-digest.util';
import { VerificationReviewService } from './verification-review.service';

interface ConflictRow {
	machineId: string;
}

@Injectable()
export class FingerprintService {
	constructor(private readonly reviews: VerificationReviewService) {}

	async record(
		manager: EntityManager,
		machineId: string,
		fingerprints: readonly FingerprintDigest[],
		benchmarkId: string
	): Promise<boolean> {
		await this.replace(manager, machineId, fingerprints);
		const conflicting = await this.conflictingMachines(
			manager,
			machineId,
			fingerprints
		);
		const machine = await manager.findOneOrFail(
			Machine,
			{ id: machineId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		machine.fingerprintConflict = conflicting.length > 0;
		if (machine.fingerprintConflict) {
			await this.reviews.open(
				manager,
				machineId,
				VerificationReviewKind.FINGERPRINT_CONFLICT,
				benchmarkId
			);
		}
		await manager.flush();
		return machine.fingerprintConflict;
	}

	private async replace(
		manager: EntityManager,
		machineId: string,
		fingerprints: readonly FingerprintDigest[]
	): Promise<void> {
		await manager.nativeDelete(MachineFingerprintComponent, { machineId });
		const unique = new Map(
			fingerprints.map((fingerprint) => [
				`${fingerprint.kind}:${fingerprint.valueDigest}`,
				fingerprint,
			])
		);
		manager.persist(
			[...unique.values()].map(({ kind, valueDigest }) => {
				const component = new MachineFingerprintComponent();
				component.machineId = machineId;
				component.kind = kind;
				component.valueDigest = valueDigest;
				return component;
			})
		);
		await manager.flush();
	}

	private async conflictingMachines(
		manager: EntityManager,
		machineId: string,
		fingerprints: readonly FingerprintDigest[]
	): Promise<string[]> {
		if (fingerprints.length === 0) return [];
		const pairs = fingerprints.map(() => '(?, ?)').join(', ');
		const rows = await manager.execute<ConflictRow[]>(
			`SELECT DISTINCT component."machineId" AS "machineId"
			   FROM "machine_fingerprint_component" component
			   JOIN "machine" machine ON machine.id = component."machineId"
			  WHERE (component.kind, component."valueDigest") IN (${pairs})
			    AND component."machineId" <> ?
			    AND machine.state <> ?`,
			[
				...fingerprints.flatMap(({ kind, valueDigest }) => [kind, valueDigest]),
				machineId,
				MachineState.DECOMMISSIONED,
			]
		);
		return rows.map((row) => row.machineId);
	}
}
