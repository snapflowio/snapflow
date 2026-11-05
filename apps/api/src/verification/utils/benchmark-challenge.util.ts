/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { create, type JsonObject } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import {
	BenchmarkMachinePayloadSchema,
	BenchmarkProfile,
} from '@snapflow/machine-proto';
import { protoJsonObject } from '../../sandbox/machine/utils/proto/proto-json.util';
import type { MachineBenchmark } from '../entities/machine-benchmark.entity';

export type ChallengedBenchmark = Pick<
	MachineBenchmark,
	| 'id'
	| 'nonce'
	| 'suiteVersion'
	| 'cpu'
	| 'memoryGib'
	| 'diskGib'
	| 'gpu'
	| 'issuedAt'
	| 'expiresAt'
>;

export function registrationChallenge(
	benchmark: ChallengedBenchmark,
	speedtestUrl: string,
	speedtestToken: string
): JsonObject {
	return protoJsonObject(
		BenchmarkMachinePayloadSchema,
		create(BenchmarkMachinePayloadSchema, {
			benchmarkId: benchmark.id,
			nonce: benchmark.nonce,
			suiteVersion: benchmark.suiteVersion,
			profile: BenchmarkProfile.REGISTRATION,
			shape: {
				cpu: benchmark.cpu,
				memoryGib: benchmark.memoryGib,
				diskGib: benchmark.diskGib,
				gpu: benchmark.gpu,
			},
			speedtestUrl,
			speedtestToken,
			issuedAt: timestampFromDate(benchmark.issuedAt),
			expiresAt: timestampFromDate(benchmark.expiresAt),
		})
	);
}
