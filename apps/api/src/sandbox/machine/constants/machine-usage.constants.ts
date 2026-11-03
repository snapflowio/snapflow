/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SHA256_HEX_LENGTH } from '../../../common/constants/digest.constants';
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';

export const MACHINE_USAGE_SIGNATURE_DOMAIN = 'snapflow.machine-usage.v5';
export const MACHINE_USAGE_GENESIS_DIGEST = '0'.repeat(SHA256_HEX_LENGTH);
export const MACHINE_USAGE_MAX_CLOCK_SKEW_MILLISECONDS =
	5 * MILLISECONDS_PER_MINUTE;
export const MACHINE_USAGE_RELEASE_GRACE_MILLISECONDS =
	10 * MILLISECONDS_PER_MINUTE;
export const MACHINE_USAGE_COUNTER_GRACE_MILLISECONDS = MILLISECONDS_PER_MINUTE;
export const MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS =
	15 * MILLISECONDS_PER_MINUTE;

export const MACHINE_USAGE_NUMERIC_PRECISION = {
	COUNTER: 30,
	NETWORK_BYTES: 40,
} as const;

export const MACHINE_NETWORK_COUNTERS = [
	'internetEgressBytes',
	'internetIngressBytes',
	'hostEgressBytes',
	'hostIngressBytes',
	'tapEgressBytes',
	'tapIngressBytes',
] as const;

export type MachineNetworkCounter = (typeof MACHINE_NETWORK_COUNTERS)[number];

export type MachineNetworkBytes = Readonly<
	Record<MachineNetworkCounter, bigint>
>;

export const MACHINE_USAGE_COLUMN_LENGTH = {
	PAYLOAD_DIGEST: 64,
	SIGNATURE: 128,
} as const;

export enum MachineUsageRuntimeState {
	CREATING = 'creating',
	RESTORING = 'restoring',
	DESTROYED = 'destroyed',
	DESTROYING = 'destroying',
	STARTED = 'started',
	PAUSED = 'paused',
	STOPPED = 'stopped',
	STARTING = 'starting',
	STOPPING = 'stopping',
	RESIZING = 'resizing',
	ERROR = 'error',
	UNKNOWN = 'unknown',
	PULLING_IMAGE = 'pulling_image',
}
