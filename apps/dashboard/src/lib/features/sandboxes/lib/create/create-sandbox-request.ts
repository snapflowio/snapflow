/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateSandbox,
	PlacementKind,
	SandboxMode,
	type SandboxPlacementRequest,
	type SandboxQuoteRequest,
	type SecretDto,
	type VolumeDto,
	VolumeState,
} from '@snapflow/api-client';
import { normalizeAllowList } from '#lib/features/sandboxes/lib/sandbox-network-policy.ts';
import { usdInputToMicroUsd } from '#lib/utils/usd.ts';
import {
	type CreateSandboxValues,
	nonEmptyLines,
	SOURCE,
} from './create-sandbox-schema.ts';

const SINGLE_GPU_COUNT = 1;

export function toCreateSandbox(
	value: CreateSandboxValues,
	secrets?: readonly SecretDto[],
	volumes?: readonly VolumeDto[]
): CreateSandbox {
	return {
		mode: value.mode,
		capabilities:
			value.capabilities.length > 0 ? value.capabilities : undefined,
		name: value.name.trim() || undefined,
		placement: toPlacementRequest(value),
		...toSandboxSource(value),
		autoStopInterval: toOptionalNumber(value.autoStopInterval),
		autoArchiveInterval: toOptionalNumber(value.autoArchiveInterval),
		autoDeleteInterval:
			value.mode === SandboxMode.Ephemeral
				? undefined
				: toOptionalNumber(value.autoDeleteInterval),
		env: toKeyValueRecord(value.environment),
		secretEnv: secrets
			? toSecretBindings(value.secretBindings, secrets)
			: undefined,
		volumes: volumes ? toVolumeMounts(value.volumeMounts, volumes) : undefined,
		labels: toKeyValueRecord(value.labels),
		networkBlockAll: value.networkBlockAll || undefined,
		networkAllowList: normalizeAllowList(value.networkAllowList),
		domainAllowList: normalizeAllowList(value.domainAllowList),
		egressBandwidthBps: toOptionalNumber(value.egressBandwidthBps),
	};
}

function toSandboxSource(
	value: CreateSandboxValues
): Pick<
	CreateSandbox,
	'buildInfo' | 'cpu' | 'disk' | 'gpu' | 'gpuType' | 'memory' | 'snapshot'
> {
	if (value.source !== SOURCE.IMAGE) {
		return { snapshot: value.snapshot || undefined };
	}
	const gpuType = value.gpu && value.gpuType ? value.gpuType : null;
	return {
		buildInfo: { dockerfileContent: `FROM ${value.image.trim()}` },
		cpu: toOptionalNumber(value.cpu),
		memory: toOptionalNumber(value.memory),
		disk: toOptionalNumber(value.disk),
		gpu: value.gpu ? SINGLE_GPU_COUNT : undefined,
		gpuType: gpuType ? [gpuType] : undefined,
	};
}

type PlacementValues = Pick<
	CreateSandboxValues,
	| 'machineId'
	| 'maxHourlyPriceUsd'
	| 'minimumTier'
	| 'placementCategory'
	| 'placementKind'
	| 'locations'
	| 'ownMachinesOnly'
>;

function toPlacementRequest(value: PlacementValues): SandboxPlacementRequest {
	if (value.placementKind === PlacementKind.Pinned) {
		return { kind: PlacementKind.Pinned, machineId: value.machineId.trim() };
	}
	return {
		kind: PlacementKind.Flexible,
		category: value.placementCategory || undefined,
		locations: value.locations.length > 0 ? value.locations : undefined,
		ownMachinesOnly: value.ownMachinesOnly || undefined,
		minimumTier: value.minimumTier || undefined,
		maxHourlyPriceMicroUsd:
			usdInputToMicroUsd(value.maxHourlyPriceUsd) ?? undefined,
	};
}

export function toSandboxQuoteRequest(
	sandbox: CreateSandbox
): SandboxQuoteRequest | null {
	if (!sandbox.placement) return null;
	return {
		placement: sandbox.placement,
		snapshot: sandbox.snapshot,
		cpu: sandbox.cpu,
		memory: sandbox.memory,
		disk: sandbox.disk,
		gpu: sandbox.gpu,
		gpuType: sandbox.gpuType,
	};
}

export function withAcceptedPrice(
	sandbox: CreateSandbox,
	priceCardId: string | undefined
): CreateSandbox {
	const { placement } = sandbox;
	if (placement?.kind !== PlacementKind.Pinned || !priceCardId) return sandbox;
	return {
		...sandbox,
		placement: { ...placement, expectedPriceCardId: priceCardId },
	};
}

function toVolumeMounts(
	value: string,
	volumes: readonly VolumeDto[]
): CreateSandbox['volumes'] {
	if (!value.trim()) return undefined;
	const volumesByName = new Map(volumes.map((volume) => [volume.name, volume]));
	return nonEmptyLines(value).map((line) => {
		const separator = line.indexOf('=');
		const volumeName = line.slice(0, separator).trim();
		const volume = volumesByName.get(volumeName);
		if (!volume || volume.state !== VolumeState.Ready) {
			throw new Error(`Volume ${volumeName} is not ready`);
		}
		return {
			volumeId: volume.id,
			mountPath: line.slice(separator + 1).trim(),
		};
	});
}

function toSecretBindings(
	value: string,
	secrets: readonly SecretDto[]
): CreateSandbox['secretEnv'] {
	if (!value.trim()) return undefined;
	const secretsByName = new Map(secrets.map((secret) => [secret.name, secret]));
	return nonEmptyLines(value).map((line) => {
		const separator = line.indexOf('=');
		const name = line.slice(0, separator).trim();
		const secretName = line.slice(separator + 1).trim();
		const secret = secretsByName.get(secretName);
		if (!secret) throw new Error(`Secret ${secretName} was not found`);
		return { name, secretId: secret.id, version: secret.currentVersion };
	});
}

function toOptionalNumber(value: string): number | undefined {
	return value.trim() === '' ? undefined : Number(value);
}

function toKeyValueRecord(value: string): Record<string, string> | undefined {
	const entries = nonEmptyLines(value).map((line) => {
		const separator = line.indexOf('=');
		return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
	});
	return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
