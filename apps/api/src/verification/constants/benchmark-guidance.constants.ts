/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BenchmarkBlocker } from '../enums/benchmark-blocker.enum';
import { BenchmarkDeferralReason } from '../enums/benchmark-deferral-reason.enum';
import type { BenchmarkGuidance } from '../types/benchmark.types';
import {
	BENCHMARK_FAILURE,
	type BenchmarkFailure,
} from './benchmark-policy.constants';

const REINSTALL_FIX =
	'Reinstall Snapflow with `sudo snapflow enroll` so the verified release runs the benchmark, then run it again. Contact support if it keeps failing.';

export const BENCHMARK_FAILURE_GUIDANCE: Readonly<
	Record<BenchmarkFailure, BenchmarkGuidance>
> = {
	[BENCHMARK_FAILURE.JOB_FAILED]: {
		summary: 'The benchmark job failed on the machine',
		fix: 'Run `sudo snapflow doctor` on the machine, fix each failed check, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.MALFORMED_RESULT]: {
		summary: 'The machine returned an unreadable benchmark result',
		fix: 'Update Snapflow to the latest release, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.WRONG_BENCHMARK]: {
		summary: 'The machine answered a different benchmark',
		fix: 'Restart Snapflow with `sudo systemctl restart snapflow`, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.BENCHMARK_IMAGE_UNTRUSTED]: {
		summary: 'The benchmark ran from an image Snapflow does not trust',
		fix: REINSTALL_FIX,
	},
	[BENCHMARK_FAILURE.WRONG_SESSION]: {
		summary: 'The benchmark result came from an unknown machine session',
		fix: 'Keep Snapflow connected while the benchmark runs, then run it again.',
	},
	[BENCHMARK_FAILURE.WRONG_KEY]: {
		summary: 'The benchmark was signed with a different machine key',
		fix: 'Re-enroll the machine with `sudo snapflow enroll`, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.SIGNATURE_INVALID]: {
		summary: 'The benchmark signature is invalid',
		fix: REINSTALL_FIX,
	},
	[BENCHMARK_FAILURE.SIGNED_OUTSIDE_WINDOW]: {
		summary: 'The benchmark was signed outside its time window',
		fix: 'Enable clock synchronization (NTP) on the machine, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.INVENTORY_INVALID]: {
		summary: 'The hardware inventory does not match its proof',
		fix: REINSTALL_FIX,
	},
	[BENCHMARK_FAILURE.INVENTORY_CHANGED]: {
		summary: 'The hardware changed while the benchmark ran',
		fix: 'Leave the hardware unchanged. Snapflow benchmarks the new hardware automatically.',
	},
	[BENCHMARK_FAILURE.WORK_TOO_SHORT]: {
		summary: 'The CPU work finished faster than the benchmark allows',
		fix: REINSTALL_FIX,
	},
	[BENCHMARK_FAILURE.CPU_PROOF_INVALID]: {
		summary: 'The CPU proof of work is invalid',
		fix: 'Check the CPU and memory for instability such as overclocking or faulty memory, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.CPU_THREADS_MISMATCH]: {
		summary:
			'The benchmark saw a different number of CPU threads than the machine reports',
		fix: 'Remove CPU limits, pinning or hotplug changes that apply to Snapflow, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.CPU_SCORE_LOW]: {
		summary: 'CPU score below the community tier minimum',
		fix: 'Disable CPU power saving and thermal throttling and stop other heavy processes, then run the benchmark again. Slower CPUs cannot be listed.',
	},
	[BENCHMARK_FAILURE.MEMORY_CAPACITY_LOW]: {
		summary: 'Less memory is usable than the machine reports',
		fix: 'Stop processes that hold memory outside Snapflow, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.MEMORY_OVERCOMMITTED]: {
		summary:
			'Memory access is too slow, so memory is overcommitted or swapping',
		fix: 'Disable swap and stop memory-heavy processes, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.DISK_MISSING]: {
		summary: 'The benchmark could not measure the disk',
		fix: 'Make sure the Snapflow data disk is mounted and writable, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.SPEEDTEST_INVALID]: {
		summary: 'The network speed test result is invalid',
		fix: REINSTALL_FIX,
	},
	[BENCHMARK_FAILURE.SPEEDTEST_MISSING]: {
		summary: 'The network speed test did not finish',
		fix: 'Check the internet connection of the machine. Snapflow retries automatically.',
	},
	[BENCHMARK_FAILURE.GPU_COUNT_MISMATCH]: {
		summary:
			'The benchmark saw a different number of GPUs than the machine reports',
		fix: 'Bind every GPU for passthrough and check `sudo snapflow doctor`, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.GPU_UNRECOGNIZED]: {
		summary: 'The GPU model is not supported',
		fix: 'Offer a supported GPU model, or remove the GPU from the machine.',
	},
	[BENCHMARK_FAILURE.GPU_MIXED_MODELS]: {
		summary: 'The machine has more than one GPU model',
		fix: 'Use a single GPU model per machine, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.GPU_NOT_IN_INVENTORY]: {
		summary: 'A benchmarked GPU is missing from the hardware inventory',
		fix: REINSTALL_FIX,
	},
	[BENCHMARK_FAILURE.VRAM_CAPACITY_LOW]: {
		summary: 'Less GPU memory is usable than the GPU reports',
		fix: 'Stop processes that use the GPU outside Snapflow, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.GEMM_PROOF_INVALID]: {
		summary: 'The GPU proof of work is invalid',
		fix: 'Check the GPU for instability such as overclocking, overheating or faulty memory, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.GPU_TFLOPS_OUT_OF_BAND]: {
		summary: 'GPU performance is outside the expected range for its model',
		fix: 'Check GPU cooling, power limits and clocks, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.GPU_PCIE_DEGRADED]: {
		summary: 'The GPU runs on a degraded PCIe link',
		fix: 'Seat the GPU in a full-width slot and check risers and BIOS PCIe settings, then run the benchmark again.',
	},
	[BENCHMARK_FAILURE.GPU_MEMORY_ERRORS]: {
		summary: 'The GPU reported memory errors',
		fix: 'Check the GPU for faulty memory and replace it if the errors persist.',
	},
};

export const BENCHMARK_DEFERRAL_GUIDANCE: Readonly<
	Record<BenchmarkDeferralReason, BenchmarkGuidance>
> = {
	[BenchmarkDeferralReason.MACHINE_BUSY]: {
		summary: 'the machine was busy',
		fix: 'Nothing to do. Snapflow retries once the machine runs no sandboxes.',
	},
	[BenchmarkDeferralReason.INSUFFICIENT_CAPACITY]: {
		summary: 'the machine had too little free capacity',
		fix: 'Free disk and memory used outside Snapflow. Snapflow retries automatically.',
	},
	[BenchmarkDeferralReason.DEADLINE_EXCEEDED]: {
		summary: 'the benchmark did not finish in time',
		fix: 'Keep the machine online and free of other heavy load. Snapflow retries automatically.',
	},
	[BenchmarkDeferralReason.SPEEDTEST_UNAVAILABLE]: {
		summary: 'the network speed test could not run',
		fix: 'Check the internet connection of the machine. Snapflow retries automatically.',
	},
	[BenchmarkDeferralReason.CHALLENGE_EXPIRED]: {
		summary: 'the machine did not finish the benchmark before it expired',
		fix: 'Keep the machine online and Snapflow running. Snapflow retries automatically.',
	},
	[BenchmarkDeferralReason.RETRYABLE_FAILURE]: {
		summary: 'the machine hit a temporary error',
		fix: 'Snapflow retries automatically. Run `sudo snapflow doctor` if it keeps happening.',
	},
};

export const BENCHMARK_BLOCKER_MESSAGE: Readonly<
	Record<BenchmarkBlocker, string>
> = {
	[BenchmarkBlocker.MACHINE_NOT_READY]: 'The machine must be online and ready',
	[BenchmarkBlocker.MACHINE_KEY_MISSING]:
		'The machine has no enrolled identity key',
	[BenchmarkBlocker.BENCHMARK_PENDING]:
		'A benchmark is already running on this machine',
	[BenchmarkBlocker.MACHINE_BUSY]:
		'Benchmarks run only while the machine runs no sandboxes or qualification',
	[BenchmarkBlocker.DISK_UNAVAILABLE]:
		'The machine has no unallocated disk to benchmark',
	[BenchmarkBlocker.SPEEDTEST_UNAVAILABLE]:
		'No edge can run the network benchmark',
};
