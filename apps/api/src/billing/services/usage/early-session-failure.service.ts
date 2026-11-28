/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { MACHINE_HEALTH_STALE_THRESHOLD_MS } from '../../../machine/constants/machine.constants';
import { MACHINE_RELIABILITY_EVENT_KIND } from '../../../machine/constants/machine-reliability.constants';
import { Machine } from '../../../machine/entities/machine.entity';
import { MachineReliabilityService } from '../../../machine/services/qualification/machine-reliability.service';
import { Sandbox } from '../../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../../sandbox/entities/sandbox-placement.entity';
import { EARLY_FAILURE_WINDOW_MILLISECONDS } from '../../../usage/constants/usage-accounting.constants';
import { SandboxUsagePeriod } from '../../../usage/entities/sandbox-usage-period.entity';
import {
	BillingAdjustmentReasonCode,
	BillingEvidenceStatus,
} from '../../constants/billing.constants';
import { BillingLineItem } from '../../entities/billing-line-item.entity';
import { EarlySessionFailure } from '../../entities/early-session-failure.entity';
import {
	earlyFailureCovers,
	openEarlyFailures,
	type SessionPeriod,
} from '../../queries/early-session-failure.query';
import { BillingLineAdjustmentService } from '../line-item/billing-line-adjustment.service';

const EARLY_FAILURE_ACTOR = 'system:early-session-failure';

type FailedPeriod = SessionPeriod &
	Pick<SandboxUsagePeriod, 'machineId' | 'customerOrganizationId'>;

@Injectable()
export class EarlySessionFailureService {
	private readonly logger = new Logger(EarlySessionFailureService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly adjustments: BillingLineAdjustmentService,
		private readonly reliability: MachineReliabilityService
	) {}

	async covers(
		manager: EntityManager,
		period: FailedPeriod,
		lastHealthyAt: Date | null,
		windowEndAt: Date
	): Promise<boolean> {
		if (await earlyFailureCovers(manager, period)) return true;
		if (
			lastHealthyAt === null ||
			lastHealthyAt.getTime() + MACHINE_HEALTH_STALE_THRESHOLD_MS >=
				windowEndAt.getTime()
		) {
			return false;
		}
		const startedAt = period.runningSince;
		if (
			startedAt === null ||
			lastHealthyAt.getTime() >=
				startedAt.getTime() + EARLY_FAILURE_WINDOW_MILLISECONDS
		) {
			return false;
		}
		await this.record(manager, period, startedAt, lastHealthyAt);
		return true;
	}

	async detectOpen(): Promise<void> {
		const manager = this.entityManager.fork();
		for (const { id } of await openEarlyFailures(manager)) {
			await manager.transactional(async (transaction) => {
				const period = await transaction.findOneOrFail(SandboxUsagePeriod, {
					id,
				});
				const machine = await transaction.findOneOrFail(
					Machine,
					{ id: period.machineId },
					{ fields: ['lastHealthyAt'] }
				);
				await this.covers(
					transaction,
					period,
					machine.lastHealthyAt,
					await databaseNow(transaction)
				);
			});
		}
	}

	private async record(
		manager: EntityManager,
		period: FailedPeriod,
		sessionStartedAt: Date,
		lastHealthyAt: Date
	): Promise<void> {
		const inserted = await manager
			.createQueryBuilder(EarlySessionFailure)
			.insert({
				placementId: period.placementId,
				sandboxId: period.sandboxId,
				assignmentGeneration: period.assignmentGeneration,
				machineId: period.machineId,
				customerOrganizationId: period.customerOrganizationId,
				sessionStartedAt,
				lastHealthyAt,
			})
			.onConflict(['placementId', 'assignmentGeneration', 'sessionStartedAt'])
			.ignore()
			.execute('run');
		if (inserted.affectedRows === 0) return;
		this.logger.warn(
			`Machine ${period.machineId} failed sandbox ${period.sandboxId} within the early failure window; the session bills nothing`
		);
		await this.creditSession(manager, period, sessionStartedAt, lastHealthyAt);
		await this.noteReliability(manager, period);
	}

	private async creditSession(
		manager: EntityManager,
		period: FailedPeriod,
		sessionStartedAt: Date,
		lastHealthyAt: Date
	): Promise<void> {
		const lines = await manager.find(BillingLineItem, {
			placementId: period.placementId,
			assignmentGeneration: period.assignmentGeneration,
			evidenceStatus: BillingEvidenceStatus.PENDING,
			periodStart: { $gte: sessionStartedAt, $lte: lastHealthyAt },
		});
		for (const line of lines) {
			const effective = await this.adjustments.effectiveCharge(manager, line);
			if (!effective.isPositive()) continue;
			await this.adjustments.credit(manager, line, {
				actorId: EARLY_FAILURE_ACTOR,
				amountMicroUsd: effective,
				explanation:
					'The machine became unhealthy within ten minutes of the start',
				reasonCode: BillingAdjustmentReasonCode.EARLY_SESSION_FAILURE,
			});
		}
	}

	private async noteReliability(
		manager: EntityManager,
		period: FailedPeriod
	): Promise<void> {
		const placement = await manager.findOne(SandboxPlacement, {
			id: period.placementId,
		});
		const sandbox = await manager.findOne(Sandbox, { id: period.sandboxId });
		if (!placement || !sandbox) return;
		await this.reliability.recordPlacementObservation(
			manager,
			MACHINE_RELIABILITY_EVENT_KIND.EARLY_SESSION_FAILURE,
			placement,
			sandbox,
			await databaseNow(manager)
		);
	}
}
