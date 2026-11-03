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
import { ConflictException, Injectable } from '@nestjs/common';
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import type { Machine } from '../../../../sandbox/machine/entities/machine.entity';
import { MachineAssessment } from '../../../../sandbox/machine/entities/machine-assessment.entity';
import type { Settings } from '../../../../settings/platform/entities/settings.entity';
import { SettingsService } from '../../../../settings/platform/services/settings.service';
import {
	BillingAdmissionErrorCode,
	HostExposureScope,
} from '../../constants/billing-admission.constants';
import { MachineTrustStage } from '../../constants/machine-trust.constants';
import { BillingBudget } from '../../entities/billing-budget.entity';
import { BillingRestrictedException } from '../../exceptions/billing-restricted.exception';
import {
	activeReservationTotal,
	monthSpend,
	unpostedCharges,
	unpostedHostExposures,
} from '../../queries/billing-admission.query';
import { ledgerBalance } from '../../queries/ledger-balance.query';
import { blockingBudgetLimits } from '../../utils/billing-budget.util';
import {
	type BillingCapacityDecision,
	type BillingCapacityInput,
	billingRestriction,
	evaluateBillingCapacity,
} from '../../utils/billing-capacity.util';
import { utcBillingMonth } from '../../utils/billing-period.util';
import { customerCreditAccount } from '../../utils/ledger/billing-ledger-accounts.util';
import { computeRunwayReservationMicroUsd } from '../../utils/ledger/billing-reservation.util';
import { trustedAssessment } from '../../utils/placement-admission.util';
import { BillingRunwayService } from '../billing-runway.service';

interface RunwayReservation {
	totalMicroUsd: MicroUsd;
	networkMicroUsd: MicroUsd;
}

interface CapacityRequest {
	customerOrganizationId: string;
	machine: Machine;
	hostOrganizationId: string;
	assessment: MachineAssessment;
	requestedMicroUsd: MicroUsd;
	networkRequestedMicroUsd: MicroUsd;
	observedAt: Date;
	renewedPlacementId?: string;
}

export interface AdmissionCandidate {
	machineId: string;
	hostOrganizationId: string;
	hourlyGrossMicroUsd: MicroUsd;
}

export interface CandidateAdmissions<Candidate extends AdmissionCandidate> {
	admitted: Candidate[];
	restriction: BillingRestrictedException | null;
}

export interface CandidateAdmission {
	customerOrganizationId: string;
	machine: Machine;
	hourlyGrossMicroUsd: MicroUsd;
}

type CustomerCapacity = Pick<
	BillingCapacityInput,
	| 'creditBalanceMicroUsd'
	| 'unpostedChargesMicroUsd'
	| 'reservedUsageMicroUsd'
	| 'monthSpendMicroUsd'
	| 'monthlyLimitMicroUsd'
	| 'networkMonthSpendMicroUsd'
	| 'networkLimitMicroUsd'
>;

export function machineExposureCeiling(
	settings: Pick<
		Settings,
		'exposureCeilingEstablishedCents' | 'exposureCeilingProbationaryCents'
	>,
	trustStage: string
): MicroUsd {
	return MicroUsd.fromCents(
		trustStage === MachineTrustStage.ESTABLISHED
			? settings.exposureCeilingEstablishedCents
			: settings.exposureCeilingProbationaryCents
	);
}

function restrictionOf(
	capacity: BillingCapacityDecision,
	requiredMicroUsd: MicroUsd
): BillingRestrictedException | null {
	const restriction = billingRestriction(capacity);
	return restriction === null
		? null
		: new BillingRestrictedException(restriction, {
				requiredMicroUsd,
				availableMicroUsd: capacity.availableMicroUsd,
			});
}

@Injectable()
export class PlacementBillingCapacityService {
	constructor(
		private readonly runway: BillingRunwayService,
		private readonly settings: SettingsService
	) {}

	async runwayReservation(
		manager: EntityManager,
		organizationId: string,
		estimatedHourlyMicroUsd: MicroUsd,
		observedAt: Date
	): Promise<RunwayReservation> {
		const budget = await manager.findOne(BillingBudget, { organizationId });
		const runwayMinutes = this.runway.minimumRunwayMinutes(budget);
		const networkMicroUsd = await this.runway.networkReservation(
			manager,
			organizationId,
			runwayMinutes,
			observedAt
		);
		return {
			networkMicroUsd,
			totalMicroUsd: computeRunwayReservationMicroUsd(
				estimatedHourlyMicroUsd,
				runwayMinutes
			).add(networkMicroUsd),
		};
	}

	async admissibleCandidates<Candidate extends AdmissionCandidate>(
		manager: EntityManager,
		customerOrganizationId: string,
		candidates: readonly Candidate[]
	): Promise<Candidate[]> {
		const { admitted } = await this.admit(
			manager,
			customerOrganizationId,
			candidates
		);
		return admitted;
	}

	async admit<Candidate extends AdmissionCandidate>(
		manager: EntityManager,
		customerOrganizationId: string,
		candidates: readonly Candidate[]
	): Promise<CandidateAdmissions<Candidate>> {
		if (candidates.length === 0) return { admitted: [], restriction: null };
		const observedAt = await databaseNow(manager);
		const settings = await this.settings.get();
		const machineIds = candidates.map(({ machineId }) => machineId);
		const customer = await this.customerCapacity(
			manager,
			customerOrganizationId,
			observedAt
		);
		const budget = await manager.findOne(BillingBudget, {
			organizationId: customerOrganizationId,
		});
		const runwayMinutes = this.runway.minimumRunwayMinutes(budget);
		const networkMicroUsd = await this.runway.networkReservation(
			manager,
			customerOrganizationId,
			runwayMinutes,
			observedAt
		);
		const assessments = await manager.find(
			MachineAssessment,
			{ machineId: { $in: machineIds } },
			{ fields: ['machineId', 'trustStage'] }
		);
		const trustStages = new Map(
			assessments.map(({ machineId, trustStage }) => [machineId, trustStage])
		);
		const machineExposures = await unpostedHostExposures(
			manager,
			HostExposureScope.MACHINE,
			machineIds
		);
		const hostExposures = await unpostedHostExposures(
			manager,
			HostExposureScope.HOST,
			[...new Set(candidates.map((candidate) => candidate.hostOrganizationId))]
		);
		const hostCeiling = MicroUsd.fromCents(settings.exposureCeilingHostCents);
		const admitted: Candidate[] = [];
		let restriction: BillingRestrictedException | null = null;
		for (const candidate of candidates) {
			const stage = trustStages.get(candidate.machineId);
			if (stage === undefined) continue;
			const requestedMicroUsd = computeRunwayReservationMicroUsd(
				candidate.hourlyGrossMicroUsd,
				runwayMinutes
			).add(networkMicroUsd);
			const capacity = evaluateBillingCapacity({
				...customer,
				requestedMicroUsd,
				networkRequestedMicroUsd: networkMicroUsd,
				machineExposureMicroUsd:
					machineExposures.get(candidate.machineId) ?? MicroUsd.ZERO,
				machineExposureLimitMicroUsd: machineExposureCeiling(settings, stage),
				hostExposureMicroUsd:
					hostExposures.get(candidate.hostOrganizationId) ?? MicroUsd.ZERO,
				hostExposureLimitMicroUsd: hostCeiling,
			});
			if (capacity.allowed) {
				admitted.push(candidate);
			} else {
				restriction ??= restrictionOf(capacity, requestedMicroUsd);
			}
		}
		return {
			admitted,
			restriction: admitted.length > 0 ? null : restriction,
		};
	}

	async assertAdmissible(
		manager: EntityManager,
		admission: CandidateAdmission
	): Promise<void> {
		const { machine } = admission;
		const observedAt = await databaseNow(manager);
		const assessment = await trustedAssessment(
			manager,
			machine,
			LockMode.PESSIMISTIC_READ
		);
		const reservation = await this.runwayReservation(
			manager,
			admission.customerOrganizationId,
			admission.hourlyGrossMicroUsd,
			observedAt
		);
		await this.assertCapacity(manager, {
			customerOrganizationId: admission.customerOrganizationId,
			machine,
			hostOrganizationId: machine.organizationId,
			assessment,
			requestedMicroUsd: reservation.totalMicroUsd,
			networkRequestedMicroUsd: reservation.networkMicroUsd,
			observedAt,
		});
	}

	async assertCapacity(
		manager: EntityManager,
		request: CapacityRequest
	): Promise<void> {
		const { machine, hostOrganizationId, renewedPlacementId } = request;
		const settings = await this.settings.get();
		const customer = await this.customerCapacity(
			manager,
			request.customerOrganizationId,
			request.observedAt,
			renewedPlacementId
		);
		const machineExposure =
			(
				await unpostedHostExposures(
					manager,
					HostExposureScope.MACHINE,
					[machine.id],
					renewedPlacementId
				)
			).get(machine.id) ?? MicroUsd.ZERO;
		const hostExposure =
			(
				await unpostedHostExposures(
					manager,
					HostExposureScope.HOST,
					[hostOrganizationId],
					renewedPlacementId
				)
			).get(hostOrganizationId) ?? MicroUsd.ZERO;
		const machineCeiling = machineExposureCeiling(
			settings,
			request.assessment.trustStage
		);
		const hostCeiling = MicroUsd.fromCents(settings.exposureCeilingHostCents);
		const capacity = evaluateBillingCapacity({
			...customer,
			renewal: renewedPlacementId !== undefined,
			requestedMicroUsd: request.requestedMicroUsd,
			networkRequestedMicroUsd: request.networkRequestedMicroUsd,
			machineExposureMicroUsd: machineExposure,
			machineExposureLimitMicroUsd: machineCeiling,
			hostExposureMicroUsd: hostExposure,
			hostExposureLimitMicroUsd: hostCeiling,
		});
		const restriction = restrictionOf(capacity, request.requestedMicroUsd);
		if (restriction) throw restriction;
		if (!capacity.machineExposureAllowed) {
			throw new ConflictException({
				code: BillingAdmissionErrorCode.MACHINE_EXPOSURE_LIMITED,
				machineId: machine.id,
				exposureMicroUsd: machineExposure.toString(),
				ceilingMicroUsd: machineCeiling.toString(),
			});
		}
		if (!capacity.hostExposureAllowed) {
			throw new ConflictException({
				code: BillingAdmissionErrorCode.HOST_EXPOSURE_LIMITED,
				hostOrganizationId,
				exposureMicroUsd: hostExposure.toString(),
				ceilingMicroUsd: hostCeiling.toString(),
			});
		}
	}

	private async customerCapacity(
		manager: EntityManager,
		customerOrganizationId: string,
		observedAt: Date,
		renewedPlacementId?: string
	): Promise<CustomerCapacity> {
		const budget = await manager.findOne(BillingBudget, {
			organizationId: customerOrganizationId,
		});
		const limits = blockingBudgetLimits(budget);
		const spend = await monthSpend(
			manager,
			customerOrganizationId,
			utcBillingMonth(observedAt).start
		);
		return {
			creditBalanceMicroUsd: await ledgerBalance(
				manager,
				customerCreditAccount(customerOrganizationId)
			),
			unpostedChargesMicroUsd: await unpostedCharges(
				manager,
				customerOrganizationId
			),
			reservedUsageMicroUsd: await activeReservationTotal(
				manager,
				customerOrganizationId,
				renewedPlacementId
			),
			monthSpendMicroUsd: spend.totalMicroUsd,
			monthlyLimitMicroUsd: limits.monthlyLimitMicroUsd,
			networkMonthSpendMicroUsd: spend.networkMicroUsd,
			networkLimitMicroUsd: limits.networkLimitMicroUsd,
		};
	}
}
