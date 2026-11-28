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
import { v4 } from 'uuid';
import {
	BillingLedgerAccountCode,
	BillingLedgerDescriptionCode,
	BillingLedgerSourceType,
} from '../../../billing/constants/billing.constants';
import { BillingLedgerService } from '../../../billing/services/ledger/billing-ledger.service';
import {
	hostPendingEarningsAccount,
	platformAccount,
} from '../../../billing/utils/ledger/billing-ledger-accounts.util';
import { LedgerPostingBuilder } from '../../../billing/utils/ledger/ledger-posting-builder.util';
import {
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_SECOND,
} from '../../../common/constants/time.constants';
import { canonicalJson } from '../../../common/utils/canonical-json.util';
import { addMilliseconds } from '../../../common/utils/time.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import type { Job } from '../../../machine-job/entities/job.entity';
import { JobType } from '../../../machine-job/enums/job-type.enum';
import { MachineListing } from '../../../marketplace/entities/machine-listing.entity';
import { MachinePriceCard } from '../../../marketplace/entities/machine-price-card.entity';
import {
	priceTerms,
	priceUsage,
	usageQuantities,
} from '../../../marketplace/utils/pricing/pricing.util';
import {
	enqueueMachineCheckFailed,
	noticeKey,
} from '../../../notification/utils/notice-outbox.util';
import { MachineCheck } from '../../constants/machine-check.constants';
import { MachineEvents } from '../../constants/machine-events.constants';
import {
	MACHINE_QUALIFICATION_POLICY,
	MACHINE_QUALIFICATION_REASON,
	MACHINE_QUALIFICATION_STATE,
	MACHINE_QUALIFICATION_VERDICT,
} from '../../constants/machine-qualification.constants';
import { Machine } from '../../entities/machine.entity';
import { MachineQualificationChallenge } from '../../entities/machine-qualification-challenge.entity';
import { MachineQualificationEvidence } from '../../entities/machine-qualification-evidence.entity';
import { MachineCheckFailedEvent } from '../../events/machine-check-failed.event';
import type { MachineQualificationEvidenceEnvelope } from '../../schemas/machine-qualification.schema';
import { sha256 } from '../../utils/qualification/machine-qualification.util';
import {
	parseQualificationEnvelope,
	qualificationFailures,
	validateQualificationEvidence,
} from '../../utils/qualification/machine-qualification-evidence.util';

const CANARY_SHAPE = {
	cpu: MACHINE_QUALIFICATION_POLICY.CANARY_CPU,
	memoryGiB: MACHINE_QUALIFICATION_POLICY.CANARY_MEMORY_GIB,
	diskGiB: MACHINE_QUALIFICATION_POLICY.CANARY_STORAGE_GIB,
	gpu: 0,
} as const;

const CANARY_RUNNING_MILLIS = BigInt(
	MACHINE_QUALIFICATION_POLICY.MAXIMUM_DURATION_SECONDS *
		MILLISECONDS_PER_SECOND
);

const HOST_PRICE_MARKUP_BASIS_POINTS = 0;

@Injectable()
export class MachineQualificationAppraisalService {
	constructor(private readonly ledger: BillingLedgerService) {}

	async appraise(
		manager: EntityManager,
		job: Job,
		resultMetadata: string | undefined,
		observedAt: Date
	): Promise<void> {
		if (job.type !== JobType.QUALIFY_MACHINE) return;
		const challenge = await manager.findOne(
			MachineQualificationChallenge,
			{ id: job.resourceId, machineId: job.machineId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (challenge?.state !== MACHINE_QUALIFICATION_STATE.PENDING) return;
		const envelope = parseQualificationEnvelope(resultMetadata);
		const machine = await manager.findOne(Machine, { id: job.machineId });
		if (!envelope) {
			const reason = MACHINE_QUALIFICATION_REASON.MALFORMED_EVIDENCE;
			complete(challenge, reason, observedAt);
			await this.recordFailure(manager, machine, challenge, null, reason);
			return;
		}
		const reason = validateQualificationEvidence(
			{ challenge, job, machine, observedAt },
			envelope
		);
		const accepted = reason === MACHINE_QUALIFICATION_REASON.ACCEPTED;
		manager.persist(
			evidenceRecord(challenge, envelope, accepted, reason, observedAt)
		);
		complete(challenge, reason, observedAt);
		if (!accepted) {
			await this.recordFailure(manager, machine, challenge, envelope, reason);
		}
		if (accepted && machine?.organizationId) {
			await this.creditCanary(
				manager,
				machine.organizationId,
				challenge,
				observedAt
			);
		}
	}

	private async recordFailure(
		manager: EntityManager,
		machine: Machine | null,
		challenge: MachineQualificationChallenge,
		envelope: MachineQualificationEvidenceEnvelope | null,
		reason: string
	): Promise<void> {
		if (!machine?.organizationId || !challenge.completedAt) return;
		await enqueueMachineCheckFailed(
			manager,
			new MachineCheckFailedEvent(
				machine.organizationId,
				machine.id,
				MachineCheck.QUALIFICATION,
				qualificationFailures(challenge, envelope, reason),
				challenge.completedAt
			),
			noticeKey(MachineEvents.CHECK_FAILED, challenge.id)
		);
	}

	private async creditCanary(
		manager: EntityManager,
		hostOrganizationId: string,
		challenge: MachineQualificationChallenge,
		observedAt: Date
	): Promise<void> {
		const paidSince = addMilliseconds(
			observedAt,
			-MACHINE_QUALIFICATION_POLICY.QUALIFICATION_TTL_HOURS *
				MILLISECONDS_PER_HOUR
		);
		const recentlyPaid = await manager.findOne(
			MachineQualificationChallenge,
			{
				machineId: challenge.machineId,
				id: { $ne: challenge.id },
				completedAt: { $gt: paidSince },
				canaryCreditMicroUsd: { $gt: '0' },
			},
			{ fields: ['id'] }
		);
		if (recentlyPaid) return;
		const creditMicroUsd = await this.canaryCredit(
			manager,
			challenge.machineId
		);
		if (!creditMicroUsd.isPositive()) return;
		challenge.canaryCreditMicroUsd = creditMicroUsd.toString();
		await this.ledger.post(
			manager,
			LedgerPostingBuilder.for({
				sourceType: BillingLedgerSourceType.QUALIFICATION_CREDIT,
				descriptionCode:
					BillingLedgerDescriptionCode.QUALIFICATION_CREDIT_GRANTED,
				sourceReference: challenge.id,
				sourceVersion: challenge.policyVersion,
				effectiveAt: observedAt,
				metadata: { machineId: challenge.machineId },
			})
				.debit(
					platformAccount(
						BillingLedgerAccountCode.PLATFORM_QUALIFICATION_EXPENSE
					),
					creditMicroUsd
				)
				.credit(hostPendingEarningsAccount(hostOrganizationId), creditMicroUsd)
				.build()
		);
	}

	private async canaryCredit(
		manager: EntityManager,
		machineId: string
	): Promise<MicroUsd> {
		const listing = await manager.findOne(MachineListing, {
			machineId: machineId,
		});
		if (!listing?.currentPriceCardId) return MicroUsd.ZERO;
		const card = await manager.findOneOrFail(MachinePriceCard, {
			id: listing.currentPriceCardId,
		});
		return priceUsage(
			priceTerms(card, CANARY_SHAPE, HOST_PRICE_MARKUP_BASIS_POINTS),
			usageQuantities(CANARY_SHAPE, CANARY_RUNNING_MILLIS, 0n)
		).hostMicroUsd;
	}
}

function evidenceRecord(
	challenge: MachineQualificationChallenge,
	{ payload, signature }: MachineQualificationEvidenceEnvelope,
	accepted: boolean,
	reason: string,
	observedAt: Date
): MachineQualificationEvidence {
	const evidence = new MachineQualificationEvidence();
	evidence.id = v4();
	evidence.challengeId = challenge.id;
	evidence.canonicalPayload = payload;
	evidence.payloadDigest = sha256(canonicalJson(payload));
	evidence.signature = signature;
	evidence.signingKeyId = payload.machineKeyId;
	evidence.releaseDigest = payload.releaseDigest;
	evidence.environmentFingerprint = payload.environmentFingerprint;
	evidence.checkResults = payload.checkResults;
	evidence.metrics = payload.metrics;
	evidence.verdict = accepted
		? MACHINE_QUALIFICATION_VERDICT.ACCEPTED
		: MACHINE_QUALIFICATION_VERDICT.REJECTED;
	evidence.reasonCodes = [reason];
	evidence.evaluatorPolicyVersion = MACHINE_QUALIFICATION_POLICY.VERSION;
	evidence.receivedAt = observedAt;
	evidence.appraisedAt = observedAt;
	evidence.createdAt = observedAt;
	return evidence;
}

function complete(
	challenge: MachineQualificationChallenge,
	reason: string,
	observedAt: Date
): void {
	challenge.state =
		reason === MACHINE_QUALIFICATION_REASON.ACCEPTED
			? MACHINE_QUALIFICATION_STATE.ACCEPTED
			: MACHINE_QUALIFICATION_STATE.REJECTED;
	challenge.reasonCode = reason;
	challenge.consumedAt = observedAt;
	challenge.completedAt = observedAt;
}
