/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { fromJson, type JsonObject } from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
	type BenchmarkMachineResult,
	BenchmarkMachineResultSchema,
	type BenchmarkMeasurements,
	type HostInventory,
} from '@snapflow/machine-proto';
import { millisecondsBetween } from '../../../common/utils/time.util';
import type {
	MachineInventory,
	MachineMeasurements,
} from '../../../marketplace/machine/types/machine.types';
import {
	BENCHMARK_FAILURE,
	type BenchmarkFailure,
} from '../constants/benchmark-policy.constants';
import { FingerprintKind } from '../enums/fingerprint-kind.enum';
import type {
	BenchmarkParameters,
	EdgeIdentityKey,
	MeasuredCompute,
} from '../types/benchmark.types';
import { verifySignedResult } from './benchmark-signature.util';
import {
	type FingerprintDigest,
	verifiedFingerprints,
} from './inventory-digest.util';
import { appraiseCompute } from './measurement-appraisal.util';
import { parseBenchmarkNonce } from './nonce-stream.util';
import {
	type SpeedtestResult,
	verifySpeedtests,
} from './speedtest-receipt.util';

export interface AppraisedBenchmark {
	id: string;
	nonce: string;
	memoryGib: number;
	diskGib: number;
	cpu: number;
	gpu: number;
	issuedAt: Date;
}

export interface AppraisedJob {
	acceptedSessionId: string | null;
	startedAt: Date | null;
	completedAt: Date | null;
}

export interface AppraisedMachine {
	identityKeyId: string | null;
	identityPublicKey: string | null;
}

export interface BenchmarkAppraisalInput {
	benchmark: AppraisedBenchmark;
	job: AppraisedJob;
	machine: AppraisedMachine;
	machineInventoryDigest: string | null;
	speedtestTokens: readonly string[];
	resultJson: JsonObject;
	trustedBenchmarkImage: string | null;
	edgeKeys: ReadonlyMap<string, EdgeIdentityKey>;
	parameters: BenchmarkParameters;
}

export type BenchmarkAppraisal =
	| {
			passed: true;
			measurements: MachineMeasurements;
			inventory: MachineInventory;
			fingerprints: FingerprintDigest[];
	  }
	| { passed: false; failures: BenchmarkFailure[] };

function rejected(...failures: BenchmarkFailure[]): BenchmarkAppraisal {
	return { passed: false, failures };
}

function parseResult(resultJson: JsonObject): BenchmarkMachineResult | null {
	try {
		return fromJson(BenchmarkMachineResultSchema, resultJson);
	} catch {
		return null;
	}
}

function bindingFailure(
	input: BenchmarkAppraisalInput,
	result: BenchmarkMachineResult,
	completedAt: Date
): BenchmarkFailure | null {
	const { benchmark, job, machine } = input;
	if (result.benchmarkId !== benchmark.id) {
		return BENCHMARK_FAILURE.WRONG_BENCHMARK;
	}
	if (!job.acceptedSessionId) return BENCHMARK_FAILURE.WRONG_SESSION;
	if (
		!machine.identityKeyId ||
		!machine.identityPublicKey ||
		result.machineKeyId !== machine.identityKeyId
	) {
		return BENCHMARK_FAILURE.WRONG_KEY;
	}
	if (
		!verifySignedResult(
			input.resultJson,
			machine.identityPublicKey,
			result.signature
		)
	) {
		return BENCHMARK_FAILURE.SIGNATURE_INVALID;
	}
	const signedAt = result.signedAt ? timestampMs(result.signedAt) : null;
	if (
		signedAt === null ||
		signedAt < benchmark.issuedAt.getTime() ||
		signedAt > completedAt.getTime()
	) {
		return BENCHMARK_FAILURE.SIGNED_OUTSIDE_WINDOW;
	}
	return null;
}

interface VerifiedResult {
	nonce: Uint8Array;
	result: BenchmarkMachineResult;
	measurements: BenchmarkMeasurements;
	inventory: HostInventory;
	fingerprints: FingerprintDigest[];
	completedAt: Date;
}

interface PassedEvidence {
	compute: MeasuredCompute;
	speedtest: SpeedtestResult;
}

function serverObservedMillis(job: AppraisedJob): number {
	return job.startedAt && job.completedAt
		? millisecondsBetween(job.startedAt, job.completedAt)
		: 0;
}

function imageFailure(
	input: BenchmarkAppraisalInput,
	result: BenchmarkMachineResult
): BenchmarkFailure | null {
	return input.trustedBenchmarkImage &&
		result.benchmarkImage === input.trustedBenchmarkImage
		? null
		: BENCHMARK_FAILURE.BENCHMARK_IMAGE_UNTRUSTED;
}

function verifyResult(
	input: BenchmarkAppraisalInput
): VerifiedResult | { failure: BenchmarkFailure } {
	const nonce = parseBenchmarkNonce(input.benchmark.nonce);
	const result = parseResult(input.resultJson);
	const measurements = result?.measurements;
	const inventory = result?.hostInventory;
	const completedAt = input.job.completedAt;
	if (!nonce || !result || !measurements || !inventory || !completedAt) {
		return { failure: BENCHMARK_FAILURE.MALFORMED_RESULT };
	}
	const failure =
		bindingFailure(input, result, completedAt) ?? imageFailure(input, result);
	if (failure) return { failure };
	const fingerprints = verifiedFingerprints(inventory);
	if (!fingerprints) return { failure: BENCHMARK_FAILURE.INVENTORY_INVALID };
	return { nonce, result, measurements, inventory, fingerprints, completedAt };
}

function workFailures(
	input: BenchmarkAppraisalInput,
	verified: VerifiedResult
): BenchmarkFailure[] {
	const failures: BenchmarkFailure[] = [];
	if (verified.inventory.inventoryDigest !== input.machineInventoryDigest) {
		failures.push(BENCHMARK_FAILURE.INVENTORY_CHANGED);
	}
	const workMillis = verified.measurements.cpu?.workMillis ?? 0n;
	const observedMillis = serverObservedMillis(input.job);
	if (
		observedMillis < input.parameters.minimumServerObservedMillis ||
		BigInt(observedMillis) < workMillis
	) {
		failures.push(BENCHMARK_FAILURE.WORK_TOO_SHORT);
	}
	return failures;
}

function passedAppraisal(
	benchmark: AppraisedBenchmark,
	verified: VerifiedResult,
	evidence: PassedEvidence
): BenchmarkAppraisal {
	const { compute, speedtest } = evidence;
	const { disk, gpu } = compute;
	return {
		passed: true,
		inventory: {
			inventoryDigest: verified.inventory.inventoryDigest,
			cpuModel: verified.inventory.cpuModel,
		},
		fingerprints: verified.fingerprints,
		measurements: {
			benchmarkId: benchmark.id,
			vcpu: compute.vcpu,
			memoryGib: benchmark.memoryGib,
			diskGib: benchmark.diskGib,
			cpuSingleThreadScore: compute.cpuSingleThreadScore,
			cpuScorePerVcpu: compute.cpuScorePerVcpu,
			memoryBandwidthMibps: compute.memoryBandwidthMibps,
			memoryLatencyNs: compute.memoryLatencyNs,
			diskRandomReadIops: disk.randomReadIops,
			diskSequentialMibps: disk.sequentialReadMibps,
			diskSequentialWriteMibps: disk.sequentialWriteMibps,
			diskReadLatencyMicros: disk.readLatencyP99Micros,
			diskFsyncLatencyMicros: disk.fsyncLatencyP99Micros,
			networkDownlinkMbps: speedtest.downlinkMbps,
			networkUplinkMbps: speedtest.uplinkMbps,
			networkMinRttMs: speedtest.minRttMs,
			networkLoadedRttMs: speedtest.loadedRttMs,
			networkJitterMs: speedtest.jitterMs,
			gpuType: gpu?.gpuType ?? null,
			gpuCount: gpu?.gpuCount ?? 0,
			gpuMemoryGib: gpu?.gpuMemoryGib ?? 0,
			gpuTflops: gpu?.gpuTflops ?? 0,
			measuredAt: verified.completedAt,
		},
	};
}

export function appraiseBenchmarkResult(
	input: BenchmarkAppraisalInput
): BenchmarkAppraisal {
	const verified = verifyResult(input);
	if ('failure' in verified) return rejected(verified.failure);
	const { benchmark } = input;
	const { measurements } = verified;
	const gpuFingerprints = new Set(
		verified.fingerprints
			.filter(({ kind }) => kind === FingerprintKind.GPU_UUID)
			.map(({ valueDigest }) => valueDigest)
	);
	const compute = appraiseCompute(
		verified.nonce,
		{
			cpu: benchmark.cpu,
			memoryGib: benchmark.memoryGib,
			diskGib: benchmark.diskGib,
			gpu: benchmark.gpu,
		},
		measurements,
		input.parameters,
		gpuFingerprints
	);
	const speedtests = verifySpeedtests(
		measurements.speedtests,
		{
			tokens: input.speedtestTokens,
			notBefore: benchmark.issuedAt,
			notAfter: verified.completedAt,
			minimumBytes: input.parameters.minimumSpeedtestBytes,
		},
		input.edgeKeys
	);
	const failures = [
		...workFailures(input, verified),
		...compute.failures,
		...(speedtests.verified ? [] : [speedtests.failure]),
	];
	if (failures.length > 0 || !compute.compute || !speedtests.verified) {
		return rejected(...new Set(failures));
	}
	return passedAppraisal(benchmark, verified, {
		compute: compute.compute,
		speedtest: speedtests.result,
	});
}
