/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import { describe, it } from 'node:test';
import {
	create,
	type JsonObject,
	type MessageInitShape,
} from '@bufbuild/protobuf';
import { timestampFromDate, timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
	BenchmarkMachineResultSchema,
	type GpuMeasurementSchema,
	type MemoryMeasurementSchema,
	FingerprintKind as ProtoFingerprintKind,
	SpeedtestDirection,
	SpeedtestReceiptSchema,
} from '@snapflow/machine-proto';
import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { protoJsonObject } from '../../machine/utils/proto/proto-json.util';
import {
	BENCHMARK_FAILURE,
	BENCHMARK_POLICY,
} from '../constants/benchmark-policy.constants';
import { GPU_MODELS } from '../constants/gpu-model.constants';
import { FingerprintKind } from '../enums/fingerprint-kind.enum';
import {
	cpuMeasurement,
	gemmFields,
	gemmRows,
	TEST_NONCE_HEX,
	TEST_PARAMETERS,
} from '../testing/benchmark.fixtures';
import type { EdgeIdentityKey } from '../types/benchmark.types';
import {
	appraiseBenchmarkResult,
	type BenchmarkAppraisalInput,
} from './benchmark-appraisal.util';
import { signedResultPayload } from './benchmark-signature.util';
import { hexDigest, inventoryDigest } from './inventory-digest.util';
import { speedtestReceiptMessage } from './speedtest-receipt.util';
import {
	signSpeedtestToken,
	speedtestSigningKey,
} from './speedtest-token.util';

const BENCHMARK_ID = 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a';
const SESSION_ID = '9b2f6c1e-3d4a-4b5c-8d6e-7f8091a2b3c4';
const MACHINE_KEY_ID = 'ed25519:machine';
const EDGE_KEY_ID = 'ed25519:edge';
const GPU_UUID = 'GPU-4f1c2a3b-5d6e-7f80-91a2-b3c4d5e6f708';
const H100_SXM_DEVICE_ID = '0x2330';
const ISSUED_AT = new Date('2026-10-14T12:00:00.000Z');
const STARTED_AT = new Date('2026-10-14T12:00:01.000Z');
const SPEEDTEST_AT = new Date('2026-10-14T12:00:05.000Z');
const SIGNED_AT = new Date('2026-10-14T12:00:09.000Z');
const COMPLETED_AT = new Date('2026-10-14T12:00:10.000Z');
const SPEEDTEST_MILLIS = 100;
const DOWNLOAD_BYTES = 10_000_000n;
const UPLOAD_BYTES = 5_000_000n;
const MEBIBYTE = 1_048_576;
const MEMORY_BYTES = 512 * MEBIBYTE;
const VRAM_BYTES = 79 * BENCHMARK_POLICY.BYTES_PER_GIB;
const SINGLE_THREAD_SCORE = 1_100;
const MULTI_THREAD_SCORE = 2_001;
const PCIE_SPEED_MTS = 32_000;
const PCIE_WIDTH = 16;
const CPU_THREADS = 2;
const GPU_COUNT = 1;
const WORK_MILLIS = 2_000n;
const SIGNATURE_FIELD = 'signature';
const BENCHMARK_IMAGE =
	'registry:5000/snapflowio/platform@sha256:5555555555555555555555555555555555555555555555555555555555555555';
const OTHER_BENCHMARK_IMAGE =
	'registry:5000/snapflowio/platform@sha256:6666666666666666666666666666666666666666666666666666666666666666';
const SPEEDTEST_KEY_SEED = Buffer.alloc(32, 7);
const SPEEDTEST_BYTE_BUDGET = 1_000_000_000n;
const SPEEDTEST_TOKEN_VALUE = signSpeedtestToken(
	speedtestSigningKey('test', SPEEDTEST_KEY_SEED),
	{
		benchmarkId: BENCHMARK_ID,
		expiresAt: COMPLETED_AT,
		byteBudget: SPEEDTEST_BYTE_BUDGET,
	}
);

const machineKeys = generateKeyPairSync('ed25519');
const edgeKeys = generateKeyPairSync('ed25519');
const forgedEdgeKeys = generateKeyPairSync('ed25519');

function pem(key: KeyObject): string {
	return key.export({ type: 'spki', format: 'pem' }).toString();
}

const registeredEdges: ReadonlyMap<string, EdgeIdentityKey> = new Map([
	[EDGE_KEY_ID, { keyId: EDGE_KEY_ID, publicKeyPem: pem(edgeKeys.publicKey) }],
]);

const components = [
	{ kind: FingerprintKind.SMBIOS_UUID, valueDigest: hexDigest('smbios-uuid') },
	{ kind: FingerprintKind.DISK_SERIAL, valueDigest: hexDigest('nvme-serial') },
	{ kind: FingerprintKind.GPU_UUID, valueDigest: hexDigest(GPU_UUID) },
];
const PROTO_KIND = {
	[FingerprintKind.SMBIOS_UUID]: ProtoFingerprintKind.SMBIOS_UUID,
	[FingerprintKind.BOARD_SERIAL]: ProtoFingerprintKind.BOARD_SERIAL,
	[FingerprintKind.DISK_SERIAL]: ProtoFingerprintKind.DISK_SERIAL,
	[FingerprintKind.GPU_UUID]: ProtoFingerprintKind.GPU_UUID,
};
const INVENTORY_DIGEST = inventoryDigest(components);

interface ReceiptLatency {
	minRttMicros: number;
	smoothedRttMicros: number;
	rttVarianceMicros: number;
}

const DOWNLOAD_LATENCY: ReceiptLatency = {
	minRttMicros: 12_000,
	smoothedRttMicros: 30_000,
	rttVarianceMicros: 4_000,
};
const UPLOAD_LATENCY: ReceiptLatency = {
	minRttMicros: 10_500,
	smoothedRttMicros: 50_000,
	rttVarianceMicros: 6_000,
};

function receipt(
	direction: SpeedtestDirection,
	bytes: bigint,
	latency: ReceiptLatency,
	signer: KeyObject
) {
	const span = {
		bytes,
		startedAtMillis: SPEEDTEST_AT.getTime(),
		finishedAtMillis: SPEEDTEST_AT.getTime() + SPEEDTEST_MILLIS,
		measuredBytes: bytes,
		measuredStartedAtMillis: SPEEDTEST_AT.getTime(),
		...latency,
		retransmittedSegments: 3n,
		sentSegments: 9_000n,
	};
	const name =
		direction === SpeedtestDirection.DOWNLOAD ? 'download' : 'upload';
	return create(SpeedtestReceiptSchema, {
		...span,
		direction,
		startedAt: timestampFromMs(span.startedAtMillis),
		finishedAt: timestampFromMs(span.finishedAtMillis),
		measuredStartedAt: timestampFromMs(span.measuredStartedAtMillis),
		edgeKeyId: EDGE_KEY_ID,
		signature: sign(
			null,
			speedtestReceiptMessage(SPEEDTEST_TOKEN_VALUE, name, span),
			signer
		),
	});
}

const productRows = gemmRows(0);

interface EnvelopeOptions {
	benchmarkId?: string;
	benchmarkImage?: string;
	uploadSigner?: KeyObject;
	memory?: MessageInitShape<typeof MemoryMeasurementSchema>;
	gpu?: MessageInitShape<typeof GpuMeasurementSchema>;
	withoutDisk?: boolean;
}

function envelope(options: EnvelopeOptions = {}): JsonObject {
	const result = create(BenchmarkMachineResultSchema, {
		benchmarkId: options.benchmarkId ?? BENCHMARK_ID,
		machineKeyId: MACHINE_KEY_ID,
		signedAt: timestampFromDate(SIGNED_AT),
		benchmarkImage: options.benchmarkImage ?? BENCHMARK_IMAGE,
		hostInventory: {
			components: components.map(({ kind, valueDigest }) => ({
				kind: PROTO_KIND[kind],
				valueDigest,
			})),
			inventoryDigest: INVENTORY_DIGEST,
			cpuModel: 'AMD EPYC 9654',
		},
		measurements: {
			cpu: {
				...cpuMeasurement(CPU_THREADS, 3, WORK_MILLIS),
				singleThreadScore: SINGLE_THREAD_SCORE,
				multiThreadScore: MULTI_THREAD_SCORE,
			},
			memory: {
				bytes: BigInt(MEMORY_BYTES),
				bandwidthMibps: 40_000,
				latencyNs: 95,
				pageTouchP999Micros: 40,
				...options.memory,
			},
			disk: options.withoutDisk
				? undefined
				: {
						randomReadIops: 450_000,
						sequentialReadMibps: 6_500,
						sequentialWriteMibps: 4_200,
						readLatencyP99Micros: 180,
						fsyncLatencyP99Micros: 900,
					},
			speedtests: [
				receipt(
					SpeedtestDirection.DOWNLOAD,
					DOWNLOAD_BYTES,
					DOWNLOAD_LATENCY,
					edgeKeys.privateKey
				),
				receipt(
					SpeedtestDirection.UPLOAD,
					UPLOAD_BYTES,
					UPLOAD_LATENCY,
					options.uploadSigner ?? edgeKeys.privateKey
				),
			],
			gpus: [
				{
					pciDeviceId: H100_SXM_DEVICE_ID,
					uuid: GPU_UUID,
					memoryGib: 80,
					vramBytes: BigInt(VRAM_BYTES),
					tflops: 650,
					pcieCurrentSpeedMts: PCIE_SPEED_MTS,
					pcieMaxSpeedMts: PCIE_SPEED_MTS,
					pcieCurrentWidth: PCIE_WIDTH,
					pcieMaxWidth: PCIE_WIDTH,
					...gemmFields(0, productRows),
					...options.gpu,
				},
			],
		},
	});
	const json = protoJsonObject(BenchmarkMachineResultSchema, result);
	return {
		...json,
		[SIGNATURE_FIELD]: sign(
			null,
			signedResultPayload(json),
			machineKeys.privateKey
		).toString('base64'),
	};
}

const signedEnvelope = envelope();

function input(
	overrides: Partial<BenchmarkAppraisalInput> = {}
): BenchmarkAppraisalInput {
	return {
		benchmark: {
			id: BENCHMARK_ID,
			nonce: TEST_NONCE_HEX,
			cpu: CPU_THREADS,
			memoryGib: 1,
			diskGib: 1,
			gpu: GPU_COUNT,
			issuedAt: ISSUED_AT,
		},
		job: {
			acceptedSessionId: SESSION_ID,
			startedAt: STARTED_AT,
			completedAt: COMPLETED_AT,
		},
		machine: {
			identityKeyId: MACHINE_KEY_ID,
			identityPublicKey: pem(machineKeys.publicKey),
		},
		machineInventoryDigest: INVENTORY_DIGEST,
		speedtestTokens: [SPEEDTEST_TOKEN_VALUE],
		resultJson: signedEnvelope,
		trustedBenchmarkImage: BENCHMARK_IMAGE,
		edgeKeys: registeredEdges,
		parameters: TEST_PARAMETERS,
		...overrides,
	};
}

function failures(appraisalInput: BenchmarkAppraisalInput): string[] {
	const appraisal = appraiseBenchmarkResult(appraisalInput);
	return appraisal.passed ? [] : appraisal.failures;
}

describe('appraiseBenchmarkResult', () => {
	it('passes a signed fixture envelope and reports the measured machine', () => {
		const appraisal = appraiseBenchmarkResult(input());
		assert.equal(appraisal.passed, true, JSON.stringify(failures(input())));
		if (!appraisal.passed) return;
		assert.deepEqual(appraisal.inventory, {
			inventoryDigest: INVENTORY_DIGEST,
			cpuModel: 'AMD EPYC 9654',
		});
		assert.deepEqual(appraisal.fingerprints, components);
		assert.deepEqual(appraisal.measurements, {
			benchmarkId: BENCHMARK_ID,
			vcpu: CPU_THREADS,
			memoryGib: 1,
			diskGib: 1,
			cpuSingleThreadScore: SINGLE_THREAD_SCORE,
			cpuScorePerVcpu: 1_000,
			memoryBandwidthMibps: 40_000,
			memoryLatencyNs: 95,
			diskRandomReadIops: 450_000,
			diskSequentialMibps: 6_500,
			diskSequentialWriteMibps: 4_200,
			diskReadLatencyMicros: 180,
			diskFsyncLatencyMicros: 900,
			networkDownlinkMbps: 800,
			networkUplinkMbps: 400,
			networkMinRttMs: 10.5,
			networkLoadedRttMs: 40,
			networkJitterMs: 5,
			gpuType: GpuType.H100,
			gpuCount: 1,
			gpuMemoryGib: 80,
			gpuTflops: 650,
			measuredAt: COMPLETED_AT,
		});
	});

	it('rejects a tampered signature', () => {
		const tampered = { ...signedEnvelope };
		tampered[SIGNATURE_FIELD] = sign(
			null,
			Buffer.from('other'),
			machineKeys.privateKey
		).toString('base64');
		assert.deepEqual(failures(input({ resultJson: tampered })), [
			BENCHMARK_FAILURE.SIGNATURE_INVALID,
		]);
	});

	it('rejects evidence signed by another machine key', () => {
		assert.deepEqual(
			failures(
				input({
					machine: {
						identityKeyId: MACHINE_KEY_ID,
						identityPublicKey: pem(edgeKeys.publicKey),
					},
				})
			),
			[BENCHMARK_FAILURE.SIGNATURE_INVALID]
		);
	});

	it('rejects a result bound to another benchmark', () => {
		assert.deepEqual(
			failures(input({ resultJson: envelope({ benchmarkId: SESSION_ID }) })),
			[BENCHMARK_FAILURE.WRONG_BENCHMARK]
		);
	});

	it('rejects a benchmark image that is not the one of a trusted release', () => {
		assert.deepEqual(
			failures(
				input({
					resultJson: envelope({ benchmarkImage: OTHER_BENCHMARK_IMAGE }),
				})
			),
			[BENCHMARK_FAILURE.BENCHMARK_IMAGE_UNTRUSTED]
		);
	});

	it('rejects a benchmark when the machine release is unknown', () => {
		assert.deepEqual(failures(input({ trustedBenchmarkImage: null })), [
			BENCHMARK_FAILURE.BENCHMARK_IMAGE_UNTRUSTED,
		]);
	});

	it('rejects a result the machine session never accepted', () => {
		assert.deepEqual(
			failures(
				input({
					job: {
						acceptedSessionId: null,
						startedAt: STARTED_AT,
						completedAt: COMPLETED_AT,
					},
				})
			),
			[BENCHMARK_FAILURE.WRONG_SESSION]
		);
	});

	it('rejects a speedtest receipt the edge did not sign', () => {
		assert.deepEqual(
			failures(
				input({
					resultJson: envelope({ uploadSigner: forgedEdgeKeys.privateKey }),
				})
			),
			[BENCHMARK_FAILURE.SPEEDTEST_INVALID]
		);
	});

	it('rejects an inventory that changed since the healthcheck', () => {
		assert.deepEqual(
			failures(input({ machineInventoryDigest: hexDigest('other inventory') })),
			[BENCHMARK_FAILURE.INVENTORY_CHANGED]
		);
	});

	it('rejects work the server did not observe for long enough', () => {
		assert.deepEqual(
			failures(
				input({
					job: {
						acceptedSessionId: SESSION_ID,
						startedAt: new Date(COMPLETED_AT.getTime() - 500),
						completedAt: COMPLETED_AT,
					},
				})
			),
			[BENCHMARK_FAILURE.WORK_TOO_SHORT]
		);
	});

	it('discounts the guest allowances from the capacity the guest must report', () => {
		const fullCoverage = {
			...TEST_PARAMETERS,
			minimumCapacityBasisPoints: BASIS_POINTS_SCALE,
		};
		const vramGib = GPU_MODELS[H100_SXM_DEVICE_ID].memoryGib;
		assert.deepEqual(failures(input({ parameters: fullCoverage })), [
			BENCHMARK_FAILURE.MEMORY_CAPACITY_LOW,
			BENCHMARK_FAILURE.VRAM_CAPACITY_LOW,
		]);
		assert.deepEqual(
			failures(
				input({
					parameters: {
						...fullCoverage,
						guestMemoryAllowanceBytes:
							BENCHMARK_POLICY.BYTES_PER_GIB - MEMORY_BYTES,
						guestVramAllowanceBytes:
							vramGib * BENCHMARK_POLICY.BYTES_PER_GIB - VRAM_BYTES,
					},
				})
			),
			[]
		);
	});

	it('expects the challenged GPU count rather than every inventoried GPU', () => {
		assert.deepEqual(
			failures(
				input({
					benchmark: {
						id: BENCHMARK_ID,
						nonce: TEST_NONCE_HEX,
						cpu: CPU_THREADS,
						memoryGib: 1,
						diskGib: 1,
						gpu: GPU_COUNT - 1,
						issuedAt: ISSUED_AT,
					},
				})
			),
			[BENCHMARK_FAILURE.GPU_COUNT_MISMATCH]
		);
	});

	it('rejects a shape the benchmark did not prove', () => {
		assert.deepEqual(
			failures(
				input({
					benchmark: {
						id: BENCHMARK_ID,
						nonce: TEST_NONCE_HEX,
						cpu: CPU_THREADS + 1,
						memoryGib: 20_000,
						diskGib: 1,
						gpu: GPU_COUNT,
						issuedAt: ISSUED_AT,
					},
				})
			),
			[
				BENCHMARK_FAILURE.CPU_THREADS_MISMATCH,
				BENCHMARK_FAILURE.MEMORY_CAPACITY_LOW,
			]
		);
	});

	it('rejects memory whose page touches stall like an overcommitted host', () => {
		assert.deepEqual(
			failures(
				input({
					resultJson: envelope({
						memory: {
							pageTouchP999Micros:
								TEST_PARAMETERS.maximumPageTouchP999Micros + 1,
						},
					}),
				})
			),
			[BENCHMARK_FAILURE.MEMORY_OVERCOMMITTED]
		);
	});

	it('rejects a GPU linked below its PCIe capability', () => {
		for (const gpu of [
			{ pcieCurrentWidth: PCIE_WIDTH / 2 },
			{ pcieCurrentSpeedMts: PCIE_SPEED_MTS / 2 },
		]) {
			assert.deepEqual(failures(input({ resultJson: envelope({ gpu }) })), [
				BENCHMARK_FAILURE.GPU_PCIE_DEGRADED,
			]);
		}
	});

	it('rejects a GPU reporting memory errors', () => {
		for (const gpu of [
			{ uncorrectedEccErrors: 1n },
			{ retiredPagesPending: true },
		]) {
			assert.deepEqual(failures(input({ resultJson: envelope({ gpu }) })), [
				BENCHMARK_FAILURE.GPU_MEMORY_ERRORS,
			]);
		}
	});

	it('requires the disk measurement', () => {
		assert.deepEqual(
			failures(input({ resultJson: envelope({ withoutDisk: true }) })),
			[BENCHMARK_FAILURE.DISK_MISSING]
		);
	});
});
