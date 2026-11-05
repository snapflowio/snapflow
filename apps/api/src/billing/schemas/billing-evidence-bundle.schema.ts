/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';
import { MachineUsageRuntimeState } from '../../sandbox/machine/constants/machine-usage.constants';
import {
	machineUsageEnvelopeSchema,
	sha256Hex as sha256,
	isoTimestamp as timestamp,
	unsignedIntegerString as unsignedInteger,
} from '../../usage/schemas/machine-usage-envelope.schema';
import { billingLineQuantitiesSchema } from './billing-line-quantities.schema';

export const BILLING_EVIDENCE_SCHEMA_VERSION = 5;

const nonnegativeDecimal = z.string().regex(/^\d+(?:\.\d+)?$/);

const signedMachineUsageReading = z.strictObject({
	signerPublicKey: z.string().min(1),
	payloadDigest: sha256,
	envelope: machineUsageEnvelopeSchema,
});

const machineUsageReceipt = signedMachineUsageReading.extend({
	id: z.uuid(),
	intervalStartAt: timestamp,
	intervalStartState: z.enum(MachineUsageRuntimeState),
	acceptedComputeDeltaMillis: unsignedInteger,
	acceptedStorageDeltaMillis: unsignedInteger,
	predecessor: signedMachineUsageReading.nullable(),
});

const attestationHeader = z.strictObject({
	policyVersion: z.number().int().positive(),
	chargedMicroUsd: unsignedInteger,
	creditedMicroUsd: unsignedInteger,
	reconciledAt: timestamp,
});

const evidenceHeader = {
	schemaVersion: z.literal(BILLING_EVIDENCE_SCHEMA_VERSION),
	lineItemId: z.uuid(),
	lineContentDigest: sha256,
	createdAt: timestamp,
};

const computeEvidence = z.strictObject({
	...evidenceHeader,
	kind: z.literal('compute'),
	source: z.strictObject({
		usagePeriodId: z.uuid(),
		machineId: z.uuid(),
		placementId: z.uuid(),
		sandboxId: z.string().min(1),
		assignmentGeneration: z.number().int().positive(),
		startAt: timestamp,
		endAt: timestamp,
		durationMillis: unsignedInteger,
		cpu: nonnegativeDecimal,
		memoryGiB: nonnegativeDecimal,
		diskGiB: nonnegativeDecimal,
		gpu: nonnegativeDecimal,
		leaseId: z.uuid(),
		priceCardId: z.uuid().nullable(),
		markupBasisPoints: z.number().int().nonnegative(),
		quantities: billingLineQuantitiesSchema,
		hostMicroUsd: unsignedInteger,
		markupMicroUsd: unsignedInteger,
		grossMicroUsd: unsignedInteger,
	}),
	attestation: attestationHeader.extend({
		computeMillis: unsignedInteger,
		storageMillis: unsignedInteger,
		receiptCount: z.number().int().nonnegative(),
		attestedQuantities: billingLineQuantitiesSchema,
		chargedHostMicroUsd: unsignedInteger,
		chargedMarkupMicroUsd: unsignedInteger,
	}),
	receipts: z.array(machineUsageReceipt),
});

const networkEvidence = z.strictObject({
	...evidenceHeader,
	kind: z.literal('network'),
	source: z.strictObject({
		networkUsagePeriodId: z.uuid(),
		leaseId: z.uuid(),
		priceCardId: z.uuid().nullable(),
		placementId: z.uuid(),
		sandboxId: z.string().min(1),
		machineId: z.uuid(),
		assignmentGeneration: z.number().int().positive(),
		periodStart: timestamp,
		periodEnd: timestamp,
		egressRateMicroUsdPerGiB: unsignedInteger,
		markupBasisPoints: z.number().int().nonnegative(),
		edgeEgressBytes: unsignedInteger,
		internetEgressBytes: unsignedInteger,
		billedEgressBytes: unsignedInteger,
		hostMicroUsd: unsignedInteger,
		markupMicroUsd: unsignedInteger,
		grossMicroUsd: unsignedInteger,
	}),
	receipts: z.array(
		z.strictObject({
			id: z.uuid(),
			payloadDigest: sha256,
			acceptedInternetEgressDeltaBytes: unsignedInteger,
		})
	),
	edgeSamples: z.array(
		z.strictObject({
			id: z.uuid(),
			edgeCheckpointId: z.uuid(),
			edgeCheckpointDigest: sha256,
			backendId: z.uuid(),
			bytesOut: unsignedInteger,
		})
	),
});

export const BillingEvidenceBundlePayloadSchema = z.discriminatedUnion('kind', [
	computeEvidence,
	networkEvidence,
]);

export type BillingEvidenceBundlePayload = z.infer<
	typeof BillingEvidenceBundlePayloadSchema
>;

export type ComputeEvidenceBundle = z.infer<typeof computeEvidence>;
export type NetworkEvidenceBundle = z.infer<typeof networkEvidence>;
export type ComputeEvidenceReceipt = z.infer<typeof machineUsageReceipt>;
