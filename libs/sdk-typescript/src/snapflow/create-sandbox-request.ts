/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	type CreateBuildInfo,
	type CreateSandbox,
	PlacementKind,
	SandboxMode,
	type SandboxPlacementRequest,
	type SandboxQuoteRequest,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import { SnapflowValidationError } from '../errors/snapflow-error.js';
import { Image } from '../image.js';
import {
	CODE_TOOLBOX_LANGUAGE_LABEL,
	CodeLanguage,
	type CreateSandboxFromImageParams,
	type CreateSandboxFromSnapshotParams,
	type PinnedPlacement,
	type Placement,
	type QuoteSandboxParams,
	type Resources,
} from '../snapflow.types.js';
import { SnapshotService } from '../snapshot.js';
import { assertNonNegativeTimeout } from '../utils/timeout.js';
import { assertNonNegativeInteger } from '../utils/validation.js';

export type CreateSandboxParams =
	| CreateSandboxFromSnapshotParams
	| CreateSandboxFromImageParams;

export function prepareCreateSandboxLabels(
	params: CreateSandboxParams,
	timeout: number
): Record<string, string> {
	if (params === undefined || params === null) {
		throw new SnapflowValidationError('Sandbox mode is required');
	}
	if (
		params.mode !== SandboxMode.Ephemeral &&
		params.mode !== SandboxMode.Standard
	) {
		throw new SnapflowValidationError(`Invalid sandbox mode: ${params.mode}`);
	}
	if (!params.language) {
		params.language = CodeLanguage.PYTHON;
	}

	const labels = params.labels || {};
	const validLanguages = Object.values(CodeLanguage) as string[];
	if (!validLanguages.includes(params.language)) {
		throw new SnapflowValidationError(
			`Invalid ${CODE_TOOLBOX_LANGUAGE_LABEL}: ${params.language}. Supported languages: ${validLanguages.join(', ')}`
		);
	}
	labels[CODE_TOOLBOX_LANGUAGE_LABEL] = params.language;

	assertNonNegativeTimeout(timeout);
	if (params.autoStopInterval !== undefined) {
		assertNonNegativeInteger(params.autoStopInterval, 'autoStopInterval');
	}
	if (params.autoArchiveInterval !== undefined) {
		assertNonNegativeInteger(params.autoArchiveInterval, 'autoArchiveInterval');
	}
	return labels;
}

export async function resolveBuildInfo(
	client: Client,
	params: CreateSandboxParams
): Promise<CreateBuildInfo | undefined> {
	if (!('image' in params)) {
		return undefined;
	}
	if (typeof params.image === 'string') {
		return { dockerfileContent: Image.base(params.image).dockerfile };
	}
	if (params.image instanceof Image) {
		const contextHashes = await SnapshotService.processImageContext(
			client,
			params.image
		);
		return { contextHashes, dockerfileContent: params.image.dockerfile };
	}
	return undefined;
}

type ResourceRequest = Pick<
	SandboxQuoteRequest,
	'cpu' | 'gpu' | 'gpuType' | 'memory' | 'disk'
>;

function toResourceRequest(resources: Resources | undefined): ResourceRequest {
	const gpuType = resources?.gpuType;
	return {
		cpu: resources?.cpu,
		gpu: resources?.gpu,
		gpuType:
			gpuType === undefined || Array.isArray(gpuType) ? gpuType : [gpuType],
		memory: resources?.memory,
		disk: resources?.disk,
	};
}

function isPinnedPlacement(placement: Placement): placement is PinnedPlacement {
	return placement.machineId !== undefined;
}

export function toPlacementRequest(
	placement: Placement | undefined
): SandboxPlacementRequest {
	if (placement !== undefined && isPinnedPlacement(placement)) {
		return {
			kind: PlacementKind.Pinned,
			machineId: placement.machineId,
			expectedPriceCardId: placement.expectedPriceCardId,
		};
	}
	return {
		kind: PlacementKind.Flexible,
		category: placement?.category,
		locations: placement?.locations,
		ownMachinesOnly: placement?.ownMachinesOnly,
		minimumTier: placement?.minimumTier,
		maxHourlyPriceMicroUsd: placement?.maxHourlyPriceMicroUsd,
		maxEgressMicroUsdPerGiB: placement?.maxEgressMicroUsdPerGiB,
	};
}

export function toSandboxQuoteRequest({
	placement,
	snapshot,
	resources,
}: QuoteSandboxParams): SandboxQuoteRequest {
	return {
		placement: toPlacementRequest(placement),
		snapshot,
		...toResourceRequest(resources),
	};
}

export function toCreateSandboxRequest(
	params: CreateSandboxParams,
	labels: Record<string, string>,
	buildInfo: CreateBuildInfo | undefined
): CreateSandbox {
	return {
		name: params.name,
		mode: params.mode,
		capabilities: params.capabilities,
		snapshot: 'snapshot' in params ? params.snapshot : undefined,
		buildInfo,
		user: params.user,
		env: params.envVars || {},
		labels,
		placement: toPlacementRequest(params.placement),
		...toResourceRequest('resources' in params ? params.resources : undefined),
		autoStopInterval: params.autoStopInterval,
		autoArchiveInterval: params.autoArchiveInterval,
		autoDeleteInterval: params.autoDeleteInterval,
		volumes: params.volumes,
		networkBlockAll: params.networkBlockAll,
		networkAllowList: params.networkAllowList,
		domainAllowList: params.domainAllowList,
		egressBandwidthBps: params.egressBandwidthBps,
		linkedSandbox: params.linkedSandbox,
	};
}
