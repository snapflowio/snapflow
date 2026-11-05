/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canonicalJson } from '../../../common/utils/canonical-json.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	BillingAuditFailure,
	BillingAuditFaultDomain,
} from '../../constants/billing-audit.constants';
import type { BillingEvidenceBundle } from '../../entities/billing-evidence-bundle.entity';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';
import {
	auditedComputeLine,
	evidenceBundle,
	tamperedReceiptBundle,
} from '../../testing/billing-audit.fixtures';
import { windowLease } from '../../usage/testing/billable-window.fixtures';
import {
	type BillingAuditVerdict,
	BillingEvidenceAuditorService,
} from './billing-evidence-auditor.service';

const AUDITOR_COUNT = 3;
const LINE_COUNT = 6;

interface Candidate {
	line: BillingLineItem;
	bundle: BillingEvidenceBundle | null;
}

function candidates(): { all: Candidate[]; failing: string[] } {
	const lines = [...Array(LINE_COUNT).keys()].map(auditedComputeLine);
	const all: Candidate[] = lines.map(({ line, bundle }) => ({ line, bundle }));
	const tampered = lines[1];
	const missing = all[4];
	assert.ok(tampered && missing);
	all[1] = { line: tampered.line, bundle: tamperedReceiptBundle(tampered) };
	missing.bundle = null;
	return { all, failing: [tampered.line.id, missing.line.id] };
}

function verdicts(
	auditor: BillingEvidenceAuditorService,
	all: readonly Candidate[]
): Map<string, BillingAuditVerdict> {
	return new Map(
		all.map(({ line, bundle }) => [
			line.id,
			auditor.audit(
				line,
				bundle,
				MicroUsd.parse(line.grossMicroUsd),
				windowLease()
			),
		])
	);
}

describe('BillingEvidenceAuditorService', () => {
	it('gives independent auditors the same quarantined set', () => {
		const { all, failing } = candidates();
		const outcomes = Array.from(
			{ length: AUDITOR_COUNT },
			() => new BillingEvidenceAuditorService()
		).map((auditor) => {
			const audited = verdicts(auditor, all);
			return {
				quarantined: all
					.filter(({ line }) => !audited.get(line.id)?.passed)
					.map(({ line }) => line.id),
				verdicts: canonicalJson(Object.fromEntries(audited)),
			};
		});
		const [first, ...others] = outcomes;
		assert.ok(first);
		assert.deepEqual(first.quarantined, failing);
		for (const other of others) assert.deepEqual(other, first);
	});

	it('attributes a tampered receipt to the machine and missing evidence to the platform', () => {
		const { all, failing } = candidates();
		const audited = verdicts(new BillingEvidenceAuditorService(), all);
		const [tamperedId, missingId] = failing;
		assert.ok(tamperedId && missingId);
		const tampered = audited.get(tamperedId);
		assert.ok(tampered && !tampered.passed);
		assert.equal(
			tampered.failure,
			BillingAuditFailure.MACHINE_EVIDENCE_INVALID
		);
		assert.equal(tampered.faultDomain, BillingAuditFaultDomain.MACHINE);
		const missing = audited.get(missingId);
		assert.ok(missing && !missing.passed);
		assert.equal(missing.failure, BillingAuditFailure.EVIDENCE_MISSING);
		assert.equal(missing.faultDomain, BillingAuditFaultDomain.PLATFORM);
	});

	it('refuses a line charged above what its evidence attests', () => {
		const { line, bundle } = auditedComputeLine(0);
		const verdict = new BillingEvidenceAuditorService().audit(
			line,
			bundle,
			MicroUsd.parse(line.grossMicroUsd).add(MicroUsd.of(1n)),
			windowLease()
		);
		assert.ok(!verdict.passed);
		assert.equal(
			verdict.failure,
			BillingAuditFailure.CHARGE_EXCEEDS_ATTESTATION
		);
	});

	it('turns evidence that makes the audit throw into a verdict', () => {
		const audited = auditedComputeLine(0);
		const malformed = structuredClone(audited.payload);
		if (malformed.kind !== 'compute')
			throw new Error('Expected compute evidence');
		const receipt = malformed.receipts.at(-1);
		assert.ok(receipt);
		receipt.signerPublicKey = 'not a public key';
		const hostile = Object.defineProperty(
			evidenceBundle(malformed),
			'payload',
			{
				get(): unknown {
					throw new TypeError('evidence read failed');
				},
			}
		);
		const auditor = new BillingEvidenceAuditorService();
		const value = MicroUsd.parse(audited.line.grossMicroUsd);

		const malformedVerdict = auditor.audit(
			audited.line,
			evidenceBundle(malformed),
			value,
			windowLease()
		);
		const hostileVerdict = auditor.audit(
			audited.line,
			hostile,
			value,
			windowLease()
		);

		assert.ok(!malformedVerdict.passed);
		assert.equal(
			malformedVerdict.failure,
			BillingAuditFailure.MACHINE_EVIDENCE_INVALID
		);
		assert.ok(!hostileVerdict.passed);
		assert.equal(hostileVerdict.failure, BillingAuditFailure.AUDIT_EXCEPTION);
		assert.equal(hostileVerdict.faultDomain, BillingAuditFaultDomain.PLATFORM);
	});
});
