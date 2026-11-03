/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';
import { MachineUsageRuntimeState } from '../../../sandbox/machine/constants/machine-usage.constants';

const ISO_TIMESTAMP_MIN_LENGTH = 20;

export const unsignedIntegerString = z.string().regex(/^(0|[1-9]\d*)$/);
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
export const sha256Hex = z.string().regex(SHA256_HEX_PATTERN);
export const isoTimestamp = z.string().min(ISO_TIMESTAMP_MIN_LENGTH);

export const machineUsageEnvelopeSchema = z.strictObject({
	placementId: z.uuid(),
	sandboxId: z.string().min(1),
	assignmentGeneration: z.number().int().positive(),
	fencingToken: z.uuid(),
	generationId: z.uuid(),
	sequence: unsignedIntegerString,
	previousDigest: sha256Hex,
	sampledAt: isoTimestamp,
	state: z.enum(MachineUsageRuntimeState),
	runningMillis: unsignedIntegerString,
	internetEgressBytes: unsignedIntegerString,
	internetIngressBytes: unsignedIntegerString,
	hostEgressBytes: unsignedIntegerString,
	hostIngressBytes: unsignedIntegerString,
	tapEgressBytes: unsignedIntegerString,
	tapIngressBytes: unsignedIntegerString,
	cpu: z.number().int().nonnegative(),
	memoryGiB: z.number().int().nonnegative(),
	diskGiB: z.number().int().nonnegative(),
	gpu: z.number().int().nonnegative(),
	signature: z.string().min(1),
});

export type MachineUsageReceiptEnvelope = z.infer<
	typeof machineUsageEnvelopeSchema
>;
