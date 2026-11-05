/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';
import {
	MACHINE_QUALIFICATION_LIMITS,
	MACHINE_QUALIFICATION_SCHEMA_VERSION,
} from '../constants/machine-qualification.constants';

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const result = z.object({
	checkId: z.string().min(1).max(MACHINE_QUALIFICATION_LIMITS.CHECK_ID_LENGTH),
	passed: z.boolean(),
	durationMs: z.number().nonnegative().finite(),
	reasonCode: z
		.string()
		.min(1)
		.max(MACHINE_QUALIFICATION_LIMITS.REASON_CODE_LENGTH),
});

const machineQualificationEvidencePayloadSchema = z
	.object({
		schemaVersion: z.literal(MACHINE_QUALIFICATION_SCHEMA_VERSION),
		policyVersion: z.number().int().positive(),
		audience: z
			.string()
			.min(1)
			.max(MACHINE_QUALIFICATION_LIMITS.AUDIENCE_LENGTH),
		challengeId: z.string().uuid(),
		requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
		machineId: z.string().uuid(),
		sessionId: z.string().uuid(),
		sessionGeneration: z.number().int().positive(),
		machineKeyId: z
			.string()
			.min(1)
			.max(MACHINE_QUALIFICATION_LIMITS.MACHINE_KEY_ID_LENGTH),
		nonce: z
			.string()
			.min(MACHINE_QUALIFICATION_LIMITS.NONCE_MIN_LENGTH)
			.max(MACHINE_QUALIFICATION_LIMITS.NONCE_MAX_LENGTH),
		inputFingerprint: digest,
		issuedAt: z.string().datetime(),
		completedAt: z.string().datetime(),
		releaseDigest: digest,
		environmentFingerprint: digest,
		checkResults: z
			.array(result)
			.min(1)
			.max(MACHINE_QUALIFICATION_LIMITS.MAX_CHECKS),
		metrics: z
			.record(
				z.string().max(MACHINE_QUALIFICATION_LIMITS.METRIC_NAME_LENGTH),
				z.number().finite()
			)
			.default({}),
	})
	.strict();

export const machineQualificationEvidenceEnvelopeSchema = z
	.object({
		payload: machineQualificationEvidencePayloadSchema,
		signature: z
			.string()
			.min(1)
			.max(MACHINE_QUALIFICATION_LIMITS.SIGNATURE_LENGTH),
	})
	.strict();

export type MachineQualificationEvidencePayload = z.infer<
	typeof machineQualificationEvidencePayloadSchema
>;

export type MachineQualificationEvidenceEnvelope = z.infer<
	typeof machineQualificationEvidenceEnvelopeSchema
>;
