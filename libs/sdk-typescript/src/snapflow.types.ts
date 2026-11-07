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

import type {
	Continent,
	GpuType,
	MachineCategory,
	MachineTier,
	SandboxCapability,
	SandboxMode,
	SandboxVolume,
	VoucherSigningMode,
} from '@snapflow/api-client';
import type { Image } from './image.js';

export const CODE_TOOLBOX_LANGUAGE_LABEL = 'code-toolbox-language';

export interface VolumeMount extends SandboxVolume {
	volumeId: string;
	mountPath: string;
}

export interface SnapflowConfig {
	apiKey?: string;
	apiUrl?: string;
}

export enum CodeLanguage {
	PYTHON = 'python',
	TYPESCRIPT = 'typescript',
	JAVASCRIPT = 'javascript',
}

export interface Resources {
	cpu?: number;
	gpu?: number;
	gpuType?: GpuType | GpuType[];
	memory?: number;
	disk?: number;
}

export type CountryCode = string;

export type LocationCode = Continent | CountryCode;

export type PinnedPlacement = {
	machineId: string;
	expectedPriceCardId?: string;
};

export type FlexiblePlacement = {
	machineId?: never;
	category?: MachineCategory;
	locations?: LocationCode[];
	ownMachinesOnly?: boolean;
	minimumTier?: MachineTier;
	maxHourlyPriceMicroUsd?: string;
	maxEgressMicroUsdPerGiB?: string;
};

export type Placement = PinnedPlacement | FlexiblePlacement;

export type QuoteSandboxParams = {
	placement?: Placement;
	snapshot?: string;
	resources?: Resources;
};

export type CreateSandboxBaseParams = {
	mode: SandboxMode;
	placement?: Placement;
	name?: string;
	user?: string;
	language?: CodeLanguage | string;
	envVars?: Record<string, string>;
	labels?: Record<string, string>;
	autoStopInterval?: number;
	autoArchiveInterval?: number;
	autoDeleteInterval?: number;
	volumes?: VolumeMount[];
	networkBlockAll?: boolean;
	networkAllowList?: string;
	domainAllowList?: string;
	egressBandwidthBps?: number;
	capabilities?: SandboxCapability[];
	linkedSandbox?: string;
	/**
	 * Who signs the escrow vouchers that pay for the sandbox. `delegated`
	 * (the API default) lets Snapflow's signer sign within the session key the
	 * funding wallet granted it; `client` leaves them to a `VoucherSigner`.
	 */
	voucherSigning?: VoucherSigningMode;
};

export type CreateSandboxFromImageParams = CreateSandboxBaseParams & {
	image: string | Image;
	resources?: Resources;
};

export type CreateSandboxFromSnapshotParams = CreateSandboxBaseParams & {
	snapshot?: string;
};

export type CreateSandboxOptions = {
	idempotencyKey?: string;
	onSnapshotCreateLogs?: (chunk: string) => void;
	timeout?: number;
	signal?: AbortSignal;
};
