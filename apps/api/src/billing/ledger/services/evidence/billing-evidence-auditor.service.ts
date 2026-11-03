/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { errorMessage } from '../../../../common/utils/error/error.util';
import type { MicroUsd } from '../../../../common/values/micro-usd.value';
import {
	BILLING_AUDIT_FAULT_DOMAIN,
	BillingAuditFailure,
	type BillingAuditFaultDomain,
} from '../../constants/billing-audit.constants';
import type { BillingEvidenceBundle } from '../../entities/billing-evidence-bundle.entity';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';
import { BillingEvidenceAuditError } from '../../exceptions/billing-evidence-audit.exception';
import type { PricedLease } from '../../queries/lease-price.query';
import {
	BILLING_EVIDENCE_SCHEMA_VERSION,
	type BillingEvidenceBundlePayload,
	BillingEvidenceBundlePayloadSchema,
} from '../../schemas/billing-evidence-bundle.schema';
import { auditComputeEvidence } from '../../utils/evidence/compute-evidence-audit.util';
import { assertEvidence } from '../../utils/evidence/evidence-audit.util';
import { auditNetworkEvidence } from '../../utils/evidence/network-evidence-audit.util';
import { billingLineContentDigest } from '../../utils/line-item/billing-line-content.util';
import { billingEvidenceRoot } from './billing-evidence-bundle.service';

export interface FailedBillingAudit {
	passed: false;
	failure: BillingAuditFailure;
	faultDomain: BillingAuditFaultDomain;
	detail: string;
}

export type BillingAuditVerdict = { passed: true } | FailedBillingAudit;

@Injectable()
export class BillingEvidenceAuditorService {
	audit(
		line: BillingLineItem,
		bundle: BillingEvidenceBundle | null,
		effectiveMicroUsd: MicroUsd,
		lease: PricedLease | null
	): BillingAuditVerdict {
		try {
			assertEvidence(
				bundle !== null,
				BillingAuditFailure.EVIDENCE_MISSING,
				'the line has no evidence bundle'
			);
			const attestedMicroUsd = attestedCharge(line, bundle, lease);
			assertEvidence(
				effectiveMicroUsd.atMost(attestedMicroUsd),
				BillingAuditFailure.CHARGE_EXCEEDS_ATTESTATION,
				'charge exceeds the attested amount'
			);
			return { passed: true };
		} catch (error) {
			const failure =
				error instanceof BillingEvidenceAuditError
					? error.failure
					: BillingAuditFailure.AUDIT_EXCEPTION;
			return {
				passed: false,
				failure,
				faultDomain: BILLING_AUDIT_FAULT_DOMAIN[failure],
				detail: errorMessage(error),
			};
		}
	}
}

function attestedCharge(
	line: BillingLineItem,
	bundle: BillingEvidenceBundle,
	lease: PricedLease | null
): MicroUsd {
	const payload = parsedPayload(bundle);
	assertEvidence(
		bundle.lineItemId === line.id && payload.lineItemId === line.id,
		BillingAuditFailure.EVIDENCE_REFERENCE_MISMATCH,
		'line reference differs'
	);
	assertEvidence(
		bundle.kind === payload.kind &&
			bundle.root === billingEvidenceRoot(payload),
		BillingAuditFailure.EVIDENCE_REFERENCE_MISMATCH,
		'content root differs'
	);
	assertEvidence(
		line.contentDigest === billingLineContentDigest(line) &&
			payload.lineContentDigest === line.contentDigest,
		BillingAuditFailure.LINE_CONTENT_MISMATCH,
		'line content digest differs'
	);
	return payload.kind === 'compute'
		? auditComputeEvidence(line, payload, lease)
		: auditNetworkEvidence(line, payload, lease);
}

function parsedPayload(
	bundle: BillingEvidenceBundle
): BillingEvidenceBundlePayload {
	const parsed = BillingEvidenceBundlePayloadSchema.safeParse(bundle.payload);
	assertEvidence(
		parsed.success && bundle.schemaVersion === BILLING_EVIDENCE_SCHEMA_VERSION,
		BillingAuditFailure.EVIDENCE_SCHEMA_UNSUPPORTED,
		'unsupported evidence schema'
	);
	return parsed.data;
}
