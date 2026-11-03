/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createPublicKey, verify } from 'node:crypto';
import { canonicalJson } from '../../../../common/utils/canonical-json.util';
import type { Job } from '../../../machine-job/entities/job.entity';
import {
	MACHINE_QUALIFICATION_POLICY,
	MACHINE_QUALIFICATION_REASON,
} from '../../constants/machine-qualification.constants';
import type { Machine } from '../../entities/machine.entity';
import type { MachineQualificationChallenge } from '../../entities/machine-qualification-challenge.entity';
import {
	type MachineQualificationEvidenceEnvelope,
	machineQualificationEvidenceEnvelopeSchema,
} from '../../schemas/machine-qualification.schema';
import {
	machineQualificationInputFingerprint,
	sha256,
} from './machine-qualification.util';

export type MachineQualificationReason =
	(typeof MACHINE_QUALIFICATION_REASON)[keyof typeof MACHINE_QUALIFICATION_REASON];

export function parseQualificationEnvelope(
	resultMetadata: string | undefined
): MachineQualificationEvidenceEnvelope | null {
	if (!resultMetadata) return null;
	try {
		return machineQualificationEvidenceEnvelopeSchema.parse(
			JSON.parse(resultMetadata)
		);
	} catch {
		return null;
	}
}

export interface QualificationEvidenceContext {
	challenge: MachineQualificationChallenge;
	job: Job;
	machine: Machine | null;
	observedAt: Date;
}

export function validateQualificationEvidence(
	context: QualificationEvidenceContext,
	envelope: MachineQualificationEvidenceEnvelope
): MachineQualificationReason {
	const { challenge, machine } = context;
	const { payload, signature } = envelope;
	const binding = bindingReason(context, envelope);
	if (binding) return binding;
	const actualChecks = new Set(
		payload.checkResults.map(({ checkId }) => checkId)
	);
	if (
		actualChecks.size !== challenge.requestedCheckIds.length ||
		payload.checkResults.length !== challenge.requestedCheckIds.length ||
		challenge.requestedCheckIds.some((checkId) => !actualChecks.has(checkId)) ||
		payload.checkResults.some(({ passed }) => !passed)
	) {
		return MACHINE_QUALIFICATION_REASON.CHECK_FAILED;
	}
	if (!machine?.identityPublicKey)
		return MACHINE_QUALIFICATION_REASON.WRONG_KEY;
	let publicKey: ReturnType<typeof createPublicKey>;
	try {
		publicKey = createPublicKey(machine.identityPublicKey);
	} catch {
		return MACHINE_QUALIFICATION_REASON.WRONG_KEY;
	}
	const valid = verify(
		null,
		Buffer.from(canonicalJson(payload), 'utf8'),
		publicKey,
		Buffer.from(signature, 'base64url')
	);
	return valid
		? MACHINE_QUALIFICATION_REASON.ACCEPTED
		: MACHINE_QUALIFICATION_REASON.SIGNATURE_INVALID;
}

function bindingReason(
	context: QualificationEvidenceContext,
	{ payload }: MachineQualificationEvidenceEnvelope
): MachineQualificationReason | null {
	const { challenge, job, machine, observedAt } = context;
	const issuedAt = new Date(payload.issuedAt);
	const completedAt = new Date(payload.completedAt);
	if (challenge.expiresAt <= observedAt) {
		return MACHINE_QUALIFICATION_REASON.EXPIRED;
	}
	if (
		payload.challengeId !== challenge.id ||
		payload.machineId !== challenge.machineId ||
		payload.requestDigest !== challenge.requestDigest ||
		issuedAt.getTime() !== challenge.issuedAt.getTime() ||
		completedAt < issuedAt ||
		completedAt > observedAt
	) {
		return MACHINE_QUALIFICATION_REASON.MALFORMED_EVIDENCE;
	}
	if (
		payload.sessionId !== challenge.machineSessionId ||
		payload.sessionGeneration !== challenge.machineSessionGeneration ||
		job.acceptedSessionId !== challenge.machineSessionId
	) {
		return MACHINE_QUALIFICATION_REASON.WRONG_SESSION;
	}
	if (
		!machine?.identityPublicKey ||
		payload.machineKeyId !== challenge.machineKeyId
	) {
		return MACHINE_QUALIFICATION_REASON.WRONG_KEY;
	}
	if (
		payload.policyVersion !== challenge.policyVersion ||
		payload.audience !== MACHINE_QUALIFICATION_POLICY.AUDIENCE
	) {
		return MACHINE_QUALIFICATION_REASON.WRONG_POLICY;
	}
	if (
		sha256(payload.nonce) !== challenge.nonceDigest ||
		payload.inputFingerprint !== challenge.inputFingerprint ||
		payload.environmentFingerprint !== challenge.inputFingerprint ||
		machineQualificationInputFingerprint(machine) !==
			challenge.inputFingerprint ||
		payload.releaseDigest !== challenge.releaseDigest
	) {
		return MACHINE_QUALIFICATION_REASON.WRONG_ENVIRONMENT;
	}
	return null;
}
