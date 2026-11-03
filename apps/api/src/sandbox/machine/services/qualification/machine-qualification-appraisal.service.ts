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
} from '../../../../billing/ledger/constants/billing.constants';
import { BillingLedgerService } from '../../../../billing/ledger/services/billing-ledger.service';
import {
	hostPendingEarningsAccount,
	platformAccount,
} from '../../../../billing/ledger/utils/ledger/billing-ledger-accounts.util';
import { LedgerPostingBuilder } from '../../../../billing/ledger/utils/ledger/ledger-posting-builder.util';
import {
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_SECOND,
} from '../../../../common/constants/time.constants';
import { canonicalJson } from '../../../../common/utils/canonical-json.util';
import { addMilliseconds } from '../../../../common/utils/time.util';
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import { MachineListing } from '../../../../marketplace/machine/entities/machine-listing.entity';
import { MachinePriceCard } from '../../../../marketplace/machine/entities/machine-price-card.entity';
import {
	priceTerms,
	priceUsage,
	usageQuantities,
} from '../../../../marketplace/machine/utils/pricing.util';
import type { Job } from '../../../machine-job/entities/job.entity';
import { JobType } from '../../../machine-job/enums/job-type.enum';
import {
	MACHINE_QUALIFICATION_POLICY,
	MACHINE_QUALIFICATION_REASON,
	MACHINE_QUALIFICATION_STATE,
	MACHINE_QUALIFICATION_VERDICT,
} from '../../constants/machine-qualification.constants';
import { Machine } from '../../entities/machine.entity';
import { MachineQualificationChallenge } from '../../entities/machine-qualification-challenge.entity';
import { MachineQualificationEvidence } from '../../entities/machine-qualification-evidence.entity';
import type { MachineQualificationEvidenceEnvelope } from '../../schemas/machine-qualification.schema';
import { sha256 } from '../../utils/qualification/machine-qualification.util';
import {
	parseQualificationEnvelope,
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
		if (!envelope) {
			complete(
				challenge,
				MACHINE_QUALIFICATION_REASON.MALFORMED_EVIDENCE,
				observedAt
			);
			return;
		}
		const machine = await manager.findOne(Machine, { id: job.machineId });
		const reason = validateQualificationEvidence(
			{ challenge, job, machine, observedAt },
			envelope
		);
		const accepted = reason === MACHINE_QUALIFICATION_REASON.ACCEPTED;
		manager.persist(
			evidenceRecord(challenge, envelope, accepted, reason, observedAt)
		);
		complete(challenge, reason, observedAt);
		if (accepted && machine?.organizationId) {
			await this.creditCanary(
				manager,
				machine.organizationId,
				challenge,
				observedAt
			);
		}
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
			priceTerms(card, HOST_PRICE_MARKUP_BASIS_POINTS),
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
