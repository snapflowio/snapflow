/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomInt } from 'node:crypto';
import { fromJsonString } from '@bufbuild/protobuf';
import {
	type SpeedtestReceipt,
	SpeedtestReceiptSchema,
} from '@snapflow/machine-proto';
import { BASIS_POINTS_DENOMINATOR } from '../../../common/constants/money.constants';
import { SPEEDTEST_ENDPOINT } from '../constants/benchmark-policy.constants';
import {
	SPOT_CHECK_CANARY,
	SPOT_CHECK_FAILURE,
	type SpotCheckFailure,
} from '../constants/spot-check.constants';
import type { ToolboxCommand } from '../types/spot-check.types';

const DOWNLOAD_RECEIPT_HEADER = 'snapflow-speedtest-receipt';
const OUTPUT_LINES = 2;

export interface CanaryTransfer {
	endpoint: string;
	downloadToken: string;
	uploadToken: string;
	uploadBytes: bigint;
}

export type CanaryVariable =
	| 'endpoint'
	| 'downloadToken'
	| 'uploadToken'
	| 'uploadBytes';

export interface CanaryReceipts {
	download: SpeedtestReceipt;
	upload: SpeedtestReceipt;
}

export interface CanaryBytes {
	uploadBytes: bigint;
	downloadBytes: bigint;
}

export interface CanaryMeasurement {
	egressBytes: bigint;
	ingressBytes: bigint;
}

export function canaryByteCount(): bigint {
	return (
		SPOT_CHECK_CANARY.MINIMUM_BYTES +
		BigInt(randomInt(Number(SPOT_CHECK_CANARY.BYTE_SPREAD)))
	);
}

export function canaryCommand(
	variables: Record<CanaryVariable, string>,
	transfer: CanaryTransfer
): ToolboxCommand {
	const base = new URL(SPEEDTEST_ENDPOINT.PATH, transfer.endpoint).toString();
	return {
		envs: {
			[variables.endpoint]: base,
			[variables.downloadToken]: transfer.downloadToken,
			[variables.uploadToken]: transfer.uploadToken,
			[variables.uploadBytes]: transfer.uploadBytes.toString(),
		},
		command: [
			'set -eu',
			'headers="$(mktemp)"',
			`trap 'rm -f "$headers"' EXIT`,
			`curl -fsS -o /dev/null -D "$headers" -H "Authorization: Bearer $${variables.downloadToken}" "$${variables.endpoint}/download?seconds=${SPOT_CHECK_CANARY.DOWNLOAD_SECONDS}"`,
			`grep -i '^${DOWNLOAD_RECEIPT_HEADER}:' "$headers" | cut -d ' ' -f 2 | tr -d '\\r'`,
			`head -c "$${variables.uploadBytes}" /dev/urandom | curl -fsS -H "Authorization: Bearer $${variables.uploadToken}" --data-binary @- "$${variables.endpoint}/upload"`,
		].join('\n'),
	};
}

export function parseCanaryReceipts(output: string): CanaryReceipts | null {
	const lines = output
		.trim()
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	if (lines.length !== OUTPUT_LINES) return null;
	const [downloadLine, uploadLine] = lines;
	try {
		return {
			download: fromJsonString(
				SpeedtestReceiptSchema,
				Buffer.from(downloadLine ?? '', 'base64url').toString('utf8')
			),
			upload: fromJsonString(SpeedtestReceiptSchema, uploadLine ?? ''),
		};
	} catch {
		return null;
	}
}

function allowance(expected: bigint): bigint {
	return (
		(expected *
			(BASIS_POINTS_DENOMINATOR + SPOT_CHECK_CANARY.OVERHEAD_BASIS_POINTS)) /
			BASIS_POINTS_DENOMINATOR +
		SPOT_CHECK_CANARY.IDLE_ALLOWANCE_BYTES
	);
}

export function judgeCanary(
	expected: CanaryBytes,
	measured: CanaryMeasurement
): SpotCheckFailure[] {
	if (
		measured.egressBytes > allowance(expected.uploadBytes) ||
		measured.ingressBytes > allowance(expected.downloadBytes)
	) {
		return [SPOT_CHECK_FAILURE.NETWORK_METER_INFLATED];
	}
	if (
		measured.egressBytes < expected.uploadBytes ||
		measured.ingressBytes < expected.downloadBytes
	) {
		return [SPOT_CHECK_FAILURE.NETWORK_METER_UNDERCOUNTED];
	}
	return [];
}
