/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SandboxCapability } from '../../sandbox/enums/sandbox-capability.enum';
import type { MachineHypervisor } from '../enums/machine-hypervisor.enum';
import type { MachineRuntimeFeature } from '../enums/machine-runtime-feature.enum';
import type { MachineUpdatePhase } from '../enums/machine-update-phase.enum';

export interface MachinePlatformArtifact {
	name: string;
	digest: string;
	platform: string;
	capabilities: SandboxCapability[];
	protocolVersion: number;
}

export interface MachineRuntimeCapabilities {
	kvmAvailable: boolean;
	cgroupV2Available: boolean;
	firecrackerSnapshotAvailable: boolean;
	firecrackerTemplateAvailable: boolean;
	hypervisors: MachineHypervisor[];
	firecrackerVersion?: string;
	cloudHypervisorVersion?: string;
	machineReleaseVersion: string;
	machineReleaseDigest: string;
	controlProtocolVersion: number;
	machineIdentity: string;
	firecrackerIdentity: string;
	cloudHypervisorIdentity: string;
	kernelIdentity?: string;
	initrdIdentity?: string;
	guestPlatforms: string[];
	preparedImageDigests: string[];
	preparedTemplateKeys: string[];
	guestReleaseDigest?: string;
	platformArtifacts: MachinePlatformArtifact[];
	features: MachineRuntimeFeature[];
	builderImage: string;
}

export interface MachineReleaseSummary {
	digest: string;
	channel: string;
	version: string;
	installedAt: string;
}

export interface MachineUpdateStatus {
	channel: string;
	maintenanceWindow: string;
	phase: MachineUpdatePhase;
	candidate?: MachineReleaseSummary;
	active?: MachineReleaseSummary;
	previous?: MachineReleaseSummary;
	lastFailure?: string;
	updatedAt: string;
}
