/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateSnapshot,
	GpuType,
	type OrganizationLimits,
	type OrganizationUsageOverview,
	SandboxClass,
} from '@snapflow/api-client';
import * as z from 'zod';
import { containerImageReferenceSchema } from './container-image-reference.ts';

const SNAPSHOT_NAME_PATTERN = /^[a-zA-Z0-9_.\-:/]+$/;
export const DEFAULT_CPU = 1;
export const DEFAULT_MEMORY_GIB = 1;
export const DEFAULT_STORAGE_GIB = 3;
export const SANDBOX_CLASS_OPTIONS = [
	{ label: 'Linux virtual machine', value: SandboxClass.LinuxVm },
];
const SELECTABLE_SANDBOX_CLASSES = SANDBOX_CLASS_OPTIONS.map(
	(option) => option.value
);
type SelectableSandboxClass = (typeof SELECTABLE_SANDBOX_CLASSES)[number];

export const CREATE_SNAPSHOT_STEPS = [
	{ key: 'source', title: 'Source' },
	{ key: 'runtime', title: 'Runtime' },
	{ key: 'review', title: 'Review' },
] as const;

const optionalResource = (label: string, maximum: number) =>
	z
		.string()
		.refine(
			(value) =>
				value.trim() === '' ||
				(Number.isInteger(Number(value)) &&
					Number(value) >= 1 &&
					Number(value) <= maximum),
			`${label} must be between 1 and ${maximum}`
		);

export const createSnapshotSchema = (
	limits: Pick<
		OrganizationLimits,
		'maxCpuPerSandbox' | 'maxDiskPerSandbox' | 'maxMemoryPerSandbox'
	>
) =>
	z
		.object({
			cpu: optionalResource('CPU', limits.maxCpuPerSandbox),
			disk: optionalResource('Storage', limits.maxDiskPerSandbox),
			entrypoint: z.string(),
			gpu: z.boolean(),
			gpuType: z.union([z.literal(''), z.enum(GpuType)]),
			imageName: containerImageReferenceSchema,
			memory: optionalResource('Memory', limits.maxMemoryPerSandbox),
			name: z
				.string()
				.trim()
				.min(1, 'Snapshot name is required')
				.refine(
					(value) => SNAPSHOT_NAME_PATTERN.test(value),
					'Use letters, digits, dots, colons, slashes, and dashes'
				),
			sandboxClass: z.literal(SandboxClass.LinuxVm),
		})
		.superRefine((value, context) => {
			if (value.gpu && !value.gpuType) {
				context.addIssue({
					code: 'custom',
					path: ['gpuType'],
					message: 'Select a GPU type',
				});
			}
		});

export type CreateSnapshotValues = z.infer<
	ReturnType<typeof createSnapshotSchema>
>;

export function getAvailableSandboxClasses(
	usage: OrganizationUsageOverview | undefined
): SelectableSandboxClass[] {
	const configured = usage?.quotaUsage
		.map((quotaUsage) => quotaUsage.sandboxClass)
		.filter(isSelectableSandboxClass);
	return configured?.length
		? [...new Set(configured)]
		: [...SELECTABLE_SANDBOX_CLASSES];
}

function isSelectableSandboxClass(
	sandboxClass: SandboxClass
): sandboxClass is SelectableSandboxClass {
	return SELECTABLE_SANDBOX_CLASSES.some(
		(selectableClass) => selectableClass === sandboxClass
	);
}

export function createDefaultValues(): CreateSnapshotValues {
	return {
		cpu: '',
		disk: '',
		entrypoint: '',
		gpu: false,
		gpuType: '',
		imageName: '',
		memory: '',
		name: '',
		sandboxClass: SandboxClass.LinuxVm,
	};
}

export function toCreateSnapshot(value: CreateSnapshotValues): CreateSnapshot {
	const entrypoint = value.entrypoint.trim();
	return {
		name: value.name.trim(),
		imageName: value.imageName.trim(),
		entrypoint: entrypoint ? entrypoint.split(/\s+/u) : undefined,
		cpu: toOptionalNumber(value.cpu),
		memory: toOptionalNumber(value.memory),
		disk: toOptionalNumber(value.disk),
		gpu: value.gpu ? 1 : undefined,
		gpuType: value.gpu && value.gpuType ? [value.gpuType] : undefined,
		sandboxClass: value.sandboxClass,
	};
}

function toOptionalNumber(value: string): number | undefined {
	return value.trim() === '' ? undefined : Number(value);
}
