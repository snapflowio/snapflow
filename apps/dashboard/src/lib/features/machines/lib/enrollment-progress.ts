/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type MachineEnrollmentKey,
	MachineEnrollmentPhase,
	type MachineFull,
} from '@snapflow/api-client';

export const EnrollmentStepStatus = {
	Done: 'done',
	Current: 'current',
	Waiting: 'waiting',
	Failed: 'failed',
} as const;

export type EnrollmentStepStatus =
	(typeof EnrollmentStepStatus)[keyof typeof EnrollmentStepStatus];

interface EnrollmentStep {
	label: string;
	status: EnrollmentStepStatus;
}

const PHASE_ORDER = [
	MachineEnrollmentPhase.Connecting,
	MachineEnrollmentPhase.Connected,
	MachineEnrollmentPhase.Benchmarking,
	MachineEnrollmentPhase.BenchmarkDeferred,
	MachineEnrollmentPhase.AwaitingApproval,
	MachineEnrollmentPhase.ReadyToList,
	MachineEnrollmentPhase.Listed,
] as const;

type ProgressPhase = (typeof PHASE_ORDER)[number];
type FailurePhase = Exclude<MachineEnrollmentPhase, ProgressPhase>;

const STEPS = [
	{ label: 'Connected', doneAt: MachineEnrollmentPhase.Connected },
	{ label: 'Benchmarking', doneAt: MachineEnrollmentPhase.AwaitingApproval },
	{ label: 'Awaiting approval', doneAt: MachineEnrollmentPhase.ReadyToList },
	{ label: 'Listed', doneAt: MachineEnrollmentPhase.Listed },
] as const satisfies readonly { label: string; doneAt: ProgressPhase }[];

type StepLabel = (typeof STEPS)[number]['label'];

export const EnrollmentFailureAction = {
	RetryBenchmark: 'retry-benchmark',
	ViewHealth: 'view-health',
} as const;

export type EnrollmentFailureAction =
	(typeof EnrollmentFailureAction)[keyof typeof EnrollmentFailureAction];

interface EnrollmentFailure {
	step: StepLabel;
	message: string;
	actions: readonly EnrollmentFailureAction[];
}

const FAILURES = {
	[MachineEnrollmentPhase.BenchmarkFailed]: {
		step: 'Benchmarking',
		message: 'The benchmark failed.',
		actions: [
			EnrollmentFailureAction.RetryBenchmark,
			EnrollmentFailureAction.ViewHealth,
		],
	},
	[MachineEnrollmentPhase.BenchmarkExpired]: {
		step: 'Benchmarking',
		message:
			'The benchmark expired. Snapflow renews it once the machine is idle.',
		actions: [
			EnrollmentFailureAction.RetryBenchmark,
			EnrollmentFailureAction.ViewHealth,
		],
	},
	[MachineEnrollmentPhase.Restricted]: {
		step: 'Awaiting approval',
		message: 'Snapflow restricted this machine.',
		actions: [EnrollmentFailureAction.ViewHealth],
	},
	[MachineEnrollmentPhase.Unresponsive]: {
		step: 'Connected',
		message: 'The machine stopped responding.',
		actions: [EnrollmentFailureAction.ViewHealth],
	},
	[MachineEnrollmentPhase.Failed]: {
		step: 'Connected',
		message: 'The machine failed its readiness checks.',
		actions: [EnrollmentFailureAction.ViewHealth],
	},
	[MachineEnrollmentPhase.Decommissioned]: {
		step: 'Connected',
		message: 'The machine was decommissioned.',
		actions: [],
	},
} as const satisfies Record<FailurePhase, EnrollmentFailure>;

function isFailurePhase(phase: MachineEnrollmentPhase): phase is FailurePhase {
	return Object.hasOwn(FAILURES, phase);
}

function stepStatus(index: number, current: number): EnrollmentStepStatus {
	if (current === -1 || index < current) return EnrollmentStepStatus.Done;
	return index === current
		? EnrollmentStepStatus.Current
		: EnrollmentStepStatus.Waiting;
}

export function enrollmentSteps(
	phase: MachineEnrollmentPhase
): EnrollmentStep[] {
	if (isFailurePhase(phase)) {
		const failed = STEPS.findIndex(
			(step) => step.label === FAILURES[phase].step
		);
		return STEPS.map(({ label }, index) => ({
			label,
			status:
				index === failed
					? EnrollmentStepStatus.Failed
					: stepStatus(index, failed),
		}));
	}
	const rank = PHASE_ORDER.indexOf(phase);
	const current = STEPS.findIndex(
		(step) => rank < PHASE_ORDER.indexOf(step.doneAt)
	);
	return STEPS.map(({ label }, index) => ({
		label,
		status: stepStatus(index, current),
	}));
}

export function enrollmentFailure(machine: MachineFull): string | null {
	const phase = machine.enrollmentPhase;
	if (!isFailurePhase(phase)) return null;
	return machine.readinessReason ?? FAILURES[phase].message;
}

export function enrollmentFailureActions(
	machine: MachineFull
): readonly EnrollmentFailureAction[] {
	const phase = machine.enrollmentPhase;
	return isFailurePhase(phase) ? FAILURES[phase].actions : [];
}

export function awaitsListing(machine: MachineFull): boolean {
	return machine.enrollmentPhase === MachineEnrollmentPhase.ReadyToList;
}

export function newestEnrollmentKey(
	keys: readonly MachineEnrollmentKey[]
): MachineEnrollmentKey | undefined {
	return keys.toSorted(
		(left, right) =>
			new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
	)[0];
}
