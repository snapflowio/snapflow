/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	GpuType,
	MachineCategory,
	MachineTier,
	type OrganizationLimits,
	PlacementKind,
	SandboxCapability,
	SandboxMode,
} from '@snapflow/api-client';
import * as z from 'zod';
import {
	domainAllowListSchema,
	MAXIMUM_EGRESS_BANDWIDTH_BPS,
	MINIMUM_EGRESS_BANDWIDTH_BPS,
	NETWORK_BLOCK_ALL_CONFLICT_MESSAGE,
	networkAllowListSchema,
	splitAllowList,
} from '#lib/features/sandboxes/lib/sandbox-network-policy.ts';
import { containerImageReferenceSchema } from '#lib/features/snapshots/lib/container-image-reference.ts';
import { usdInputToMicroUsd } from '#lib/utils/usd.ts';

const SANDBOX_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const IMMEDIATE_AUTO_DELETE_INTERVAL = 0;
const DEFAULT_CPU = 1;
const DEFAULT_MEMORY_GIB = 1;
const DEFAULT_DISK_GIB = 3;
const MAXIMUM_PLACEMENT_LOCATIONS = 16;
export const SOURCE = {
	IMAGE: 'image',
	SNAPSHOT: 'snapshot',
} as const;

export function nonEmptyLines(value: string): string[] {
	return value
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter(Boolean);
}

const optionalInteger = (label: string, minimum: number, maximum?: number) =>
	z
		.string()
		.refine(
			(value) =>
				value.trim() === '' ||
				(Number.isInteger(Number(value)) &&
					Number(value) >= minimum &&
					(maximum === undefined || Number(value) <= maximum)),
			maximum === undefined
				? `${label} must be a whole number of at least ${minimum}`
				: `${label} must be between ${minimum} and ${maximum}`
		);

const optionalDuration = (label: string, minimum: number) =>
	z
		.string()
		.refine(
			(value) =>
				value.trim() === '' ||
				(Number.isInteger(Number(value)) && Number(value) >= minimum),
			`Choose a listed ${label} duration or enter a whole number of minutes`
		);

const keyValueLines = z.string().superRefine((value, context) => {
	const keys = new Set<string>();
	for (const [index, line] of nonEmptyLines(value).entries()) {
		const separator = line.indexOf('=');
		const key = line.slice(0, separator).trim();
		if (separator < 1 || !key) {
			context.addIssue({
				code: 'custom',
				message: `Line ${index + 1} must use KEY=VALUE`,
			});
			continue;
		}
		if (keys.has(key)) {
			context.addIssue({
				code: 'custom',
				message: `Duplicate key: ${key}`,
			});
		}
		keys.add(key);
	}
});

const volumeMountLines = z.string().superRefine((value, context) => {
	const volumes = new Set<string>();
	const mountPaths = new Set<string>();
	for (const [index, line] of nonEmptyLines(value).entries()) {
		const separator = line.indexOf('=');
		const volume = line.slice(0, separator).trim();
		const mountPath = line.slice(separator + 1).trim();
		if (separator < 1 || !volume || !mountPath.startsWith('/')) {
			context.addIssue({
				code: 'custom',
				message: `Line ${index + 1} must use VOLUME=/absolute/path`,
			});
			continue;
		}
		if (volumes.has(volume)) {
			context.addIssue({
				code: 'custom',
				message: `Duplicate volume: ${volume}`,
			});
		}
		if (mountPaths.has(mountPath)) {
			context.addIssue({
				code: 'custom',
				message: `Duplicate mount path: ${mountPath}`,
			});
		}
		volumes.add(volume);
		mountPaths.add(mountPath);
	}
});

const createSandboxFieldsSchema = (
	limits: Pick<
		OrganizationLimits,
		'maxCpuPerSandbox' | 'maxDiskPerSandbox' | 'maxMemoryPerSandbox'
	>
) =>
	z.object({
		autoArchiveInterval: optionalDuration('archive', 0),
		autoDeleteInterval: optionalDuration('deletion', -1),
		autoStopInterval: optionalDuration('stop', 0),
		capabilities: z.array(z.enum(SandboxCapability)),
		cpu: optionalInteger('CPU', 1, limits.maxCpuPerSandbox),
		disk: optionalInteger('Storage', 1, limits.maxDiskPerSandbox),
		domainAllowList: domainAllowListSchema,
		egressBandwidthBps: optionalInteger(
			'Egress bandwidth',
			MINIMUM_EGRESS_BANDWIDTH_BPS,
			MAXIMUM_EGRESS_BANDWIDTH_BPS
		),
		environment: keyValueLines,
		gpu: z.boolean(),
		gpuType: z.union([z.literal(''), z.enum(GpuType)]),
		image: z.string(),
		labels: keyValueLines,
		machineId: z.string(),
		maxHourlyPriceUsd: z
			.string()
			.refine(
				(value) => value.trim() === '' || usdInputToMicroUsd(value) !== null,
				'Enter a USD amount with at most six decimal places'
			),
		memory: optionalInteger('Memory', 1, limits.maxMemoryPerSandbox),
		minimumTier: z.union([z.literal(''), z.enum(MachineTier)]),
		mode: z.enum([SandboxMode.Ephemeral, SandboxMode.Standard]),
		name: z
			.string()
			.refine(
				(value) => value.trim() === '' || SANDBOX_NAME_PATTERN.test(value),
				'Use letters, digits, dots, underscores, and dashes'
			),
		networkAllowList: networkAllowListSchema,
		networkBlockAll: z.boolean(),
		placementCategory: z.union([z.literal(''), z.enum(MachineCategory)]),
		placementKind: z.enum(PlacementKind),
		locations: z.array(z.string()).max(MAXIMUM_PLACEMENT_LOCATIONS),
		ownMachinesOnly: z.boolean(),
		secretBindings: keyValueLines,
		snapshot: z.string(),
		source: z.enum([SOURCE.SNAPSHOT, SOURCE.IMAGE]),
		volumeMounts: volumeMountLines,
	});

export type CreateSandboxValues = z.infer<
	ReturnType<typeof createSandboxFieldsSchema>
>;
type SandboxFieldPath = keyof CreateSandboxValues;

function addFieldIssue(
	context: z.RefinementCtx,
	path: SandboxFieldPath,
	message: string
): void {
	context.addIssue({ code: 'custom', path: [path], message });
}

function lineKey(line: string): string {
	return line.slice(0, line.indexOf('=')).trim();
}

function refineSecretBindings(
	value: CreateSandboxValues,
	context: z.RefinementCtx
): void {
	const environmentNames = new Set(
		nonEmptyLines(value.environment).map(lineKey)
	);
	for (const [index, line] of nonEmptyLines(value.secretBindings).entries()) {
		const name = lineKey(line);
		if (environmentNames.has(name)) {
			addFieldIssue(
				context,
				'secretBindings',
				`Line ${index + 1} duplicates environment variable ${name}`
			);
		}
	}
}

function refineAutoDelete(
	value: CreateSandboxValues,
	context: z.RefinementCtx
): void {
	const configuredAutoDelete = value.autoDeleteInterval.trim();
	if (configuredAutoDelete === '') return;
	const ephemeral = value.mode === SandboxMode.Ephemeral;
	const immediate =
		Number(configuredAutoDelete) === IMMEDIATE_AUTO_DELETE_INTERVAL;
	if (ephemeral === immediate) return;
	addFieldIssue(
		context,
		'autoDeleteInterval',
		ephemeral
			? 'Ephemeral sandboxes are deleted immediately when stopped'
			: 'Select ephemeral mode to delete immediately when stopped'
	);
}

function refinePlacement(
	value: CreateSandboxValues,
	context: z.RefinementCtx
): void {
	if (value.placementKind === PlacementKind.Pinned && !value.machineId.trim()) {
		addFieldIssue(context, 'machineId', 'Select a machine');
	}
}

function refineNetworkPolicy(
	value: CreateSandboxValues,
	context: z.RefinementCtx
): void {
	if (!value.networkBlockAll) return;
	for (const path of ['networkAllowList', 'domainAllowList'] as const) {
		if (splitAllowList(value[path]).length > 0) {
			addFieldIssue(context, path, NETWORK_BLOCK_ALL_CONFLICT_MESSAGE);
		}
	}
}

function refineImageSource(
	value: CreateSandboxValues,
	context: z.RefinementCtx
): void {
	if (value.source !== SOURCE.IMAGE) return;
	const imageResult = containerImageReferenceSchema.safeParse(value.image);
	for (const issue of imageResult.error?.issues ?? []) {
		addFieldIssue(context, 'image', issue.message);
	}
	if (value.gpu && !value.gpuType) {
		addFieldIssue(context, 'gpuType', 'Select a GPU type');
	}
}

const CREATE_SANDBOX_REFINEMENTS = [
	refineSecretBindings,
	refineAutoDelete,
	refinePlacement,
	refineNetworkPolicy,
	refineImageSource,
];

export const createSandboxSchema = (
	limits: Parameters<typeof createSandboxFieldsSchema>[0]
) =>
	createSandboxFieldsSchema(limits).superRefine((value, context) => {
		for (const refine of CREATE_SANDBOX_REFINEMENTS) refine(value, context);
	});

export function createDefaultValues(
	pinnedMachineId: string | null
): CreateSandboxValues {
	return {
		autoArchiveInterval: '',
		autoDeleteInterval: '',
		autoStopInterval: '',
		capabilities: [],
		cpu: String(DEFAULT_CPU),
		disk: String(DEFAULT_DISK_GIB),
		domainAllowList: '',
		egressBandwidthBps: '',
		environment: '',
		gpu: false,
		gpuType: '',
		image: '',
		labels: '',
		machineId: pinnedMachineId ?? '',
		maxHourlyPriceUsd: '',
		memory: String(DEFAULT_MEMORY_GIB),
		minimumTier: '',
		mode: SandboxMode.Ephemeral,
		name: '',
		networkAllowList: '',
		networkBlockAll: false,
		placementCategory: '',
		placementKind: pinnedMachineId
			? PlacementKind.Pinned
			: PlacementKind.Flexible,
		locations: [],
		ownMachinesOnly: false,
		secretBindings: '',
		snapshot: '',
		source: SOURCE.SNAPSHOT,
		volumeMounts: '',
	};
}
