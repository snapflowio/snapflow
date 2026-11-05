/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes } from 'node:crypto';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import {
	BenchmarkMachinePayloadSchema,
	BenchmarkProfile,
} from '@snapflow/machine-proto';
import { canonicalJson } from '../../common/utils/canonical-json.util';
import { protoJsonObject } from '../../machine/utils/proto/proto-json.util';
import { BENCHMARK_SUITE_VERSION } from '../constants/benchmark-policy.constants';
import {
	SPOT_CHECK,
	SPOT_CHECK_BENCHMARK_TOOL,
} from '../constants/spot-check.constants';
import type {
	SpotCheckChallenge,
	ToolboxCommand,
} from '../types/spot-check.types';

export function hiddenVariableName(): string {
	return `${SPOT_CHECK.ENVIRONMENT_NAME_PREFIX}${randomBytes(
		SPOT_CHECK.ENVIRONMENT_NAME_BYTES
	)
		.toString('hex')
		.toUpperCase()}`;
}

export function spotCheckChallengeJson(challenge: SpotCheckChallenge): string {
	return canonicalJson(
		protoJsonObject(
			BenchmarkMachinePayloadSchema,
			create(BenchmarkMachinePayloadSchema, {
				benchmarkId: challenge.id,
				nonce: challenge.nonce,
				suiteVersion: BENCHMARK_SUITE_VERSION,
				profile: BenchmarkProfile.SPOT_CHECK,
				shape: challenge.shape,
				issuedAt: timestampFromDate(challenge.issuedAt),
				expiresAt: timestampFromDate(challenge.expiresAt),
			})
		)
	);
}

export function spotCheckToolPath(): string {
	return `${SPOT_CHECK_BENCHMARK_TOOL.SANDBOX_DIRECTORY}/${hiddenVariableName().toLowerCase()}`;
}

export function spotCheckCommand(
	toolPath: string,
	variableName: string,
	challengeJson: string
): ToolboxCommand {
	return {
		envs: { [variableName]: challengeJson },
		command: [
			'set -eu',
			'output="$(mktemp)"',
			`trap 'rm -f "${toolPath}" "$output"' EXIT`,
			`chmod 0700 "${toolPath}"`,
			`"${toolPath}" run --challenge "$${variableName}" >"$output" 2>/dev/null`,
			'cat "$output"',
		].join('\n'),
	};
}
