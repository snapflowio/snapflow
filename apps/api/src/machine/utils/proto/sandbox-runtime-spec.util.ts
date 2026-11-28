/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { create, fromJson, type JsonObject } from '@bufbuild/protobuf';
import {
	type NetworkPolicy,
	NetworkPolicySchema,
	type SandboxResources,
	SandboxResourcesSchema,
	type SandboxSpec,
	SandboxSpecSchema,
	type VolumeAttachment,
	VolumeAttachmentSchema,
} from '@snapflow/machine-proto';
import type { Sandbox } from '../../../sandbox/entities/sandbox.entity';
import type { Volume } from '../../../volume/entities/volume.entity';
import { optionalUint64 } from './proto-integer.util';
import { protoJsonDigest, protoJsonObject } from './proto-json.util';

export type SandboxSpecSource = SandboxSpec['source'];

export type SandboxNetworkFields = Pick<
	Sandbox,
	| 'networkBlockAll'
	| 'networkAllowList'
	| 'domainAllowList'
	| 'egressBandwidthBps'
	| 'networkThrottleBandwidthBps'
	| 'networkThrottleConnectionsPerSecond'
	| 'abuseEgressBlock'
>;

type SandboxResourceFields = Pick<Sandbox, 'cpu' | 'gpu' | 'mem' | 'disk'>;

type SandboxSpecFields = SandboxNetworkFields &
	SandboxResourceFields &
	Pick<
		Sandbox,
		| 'mode'
		| 'capabilities'
		| 'name'
		| 'organizationId'
		| 'osUser'
		| 'env'
		| 'volumes'
		| 'linkedSandboxId'
	>;

export type FencedVolume = Pick<
	Volume,
	'name' | 'sizeGiB' | 'filesystem' | 'attachmentGeneration' | 'fencingToken'
>;

interface SandboxSpecInput {
	sandbox: SandboxSpecFields;
	source: SandboxSpecSource;
	fencedVolumes: ReadonlyMap<string, FencedVolume>;
	labels: Record<string, string>;
}

interface EncodedSandboxSpec {
	runtimeSpec: JsonObject;
	runtimeSpecDigest: string;
}

function tightestLimit(
	...limits: readonly (number | null | undefined)[]
): number | null {
	const defined = limits.filter(
		(limit): limit is number => typeof limit === 'number'
	);
	return defined.length > 0 ? Math.min(...defined) : null;
}

export function sandboxNetworkPolicy(
	sandbox: SandboxNetworkFields
): NetworkPolicy {
	const blocked = sandbox.abuseEgressBlock;
	const throttleBandwidthBps = sandbox.networkThrottleBandwidthBps;
	return create(NetworkPolicySchema, {
		blockAll: blocked || sandbox.networkBlockAll,
		allowList: blocked ? undefined : (sandbox.networkAllowList ?? undefined),
		domainAllowList: blocked
			? undefined
			: (sandbox.domainAllowList ?? undefined),
		egressBandwidthBps: optionalUint64(
			tightestLimit(sandbox.egressBandwidthBps, throttleBandwidthBps)
		),
		ingressBandwidthBps: optionalUint64(throttleBandwidthBps),
		newConnectionsPerSecond:
			sandbox.networkThrottleConnectionsPerSecond ?? undefined,
	});
}

export function sandboxResources(
	sandbox: SandboxResourceFields
): SandboxResources {
	return create(SandboxResourcesSchema, {
		cpuQuota: sandbox.cpu,
		gpuQuota: sandbox.gpu,
		memoryQuota: sandbox.mem,
		storageQuota: sandbox.disk,
	});
}

function volumeAttachments(
	sandbox: Pick<Sandbox, 'volumes'>,
	fencedVolumes: ReadonlyMap<string, FencedVolume>
): VolumeAttachment[] {
	return sandbox.volumes.map((mount) => {
		const fenced = fencedVolumes.get(mount.volumeId);
		if (!fenced?.fencingToken) {
			throw new Error(`Volume ${mount.volumeId} was not fenced for attachment`);
		}
		return create(VolumeAttachmentSchema, {
			volumeId: mount.volumeId,
			name: fenced.name,
			sizeGiB: fenced.sizeGiB,
			filesystem: fenced.filesystem,
			generation: fenced.attachmentGeneration,
			fencingToken: fenced.fencingToken,
			mountPath: mount.mountPath,
			subpath: mount.subpath,
		});
	});
}

export function buildSandboxSpec(input: SandboxSpecInput): SandboxSpec {
	const { sandbox } = input;
	return create(SandboxSpecSchema, {
		mode: sandbox.mode,
		capabilities: sandbox.capabilities,
		name: sandbox.name,
		userId: sandbox.organizationId,
		osUser: sandbox.osUser,
		resources: sandboxResources(sandbox),
		env: sandbox.env,
		volumes: volumeAttachments(sandbox, input.fencedVolumes),
		network: sandboxNetworkPolicy(sandbox),
		labels: input.labels,
		linkedSandboxId: sandbox.linkedSandboxId ?? undefined,
		source: input.source,
	});
}

export function encodeSandboxSpec(spec: SandboxSpec): EncodedSandboxSpec {
	return {
		runtimeSpec: protoJsonObject(SandboxSpecSchema, spec),
		runtimeSpecDigest: protoJsonDigest(SandboxSpecSchema, spec),
	};
}

export function decodeSandboxSpec(runtimeSpec: JsonObject): SandboxSpec {
	return fromJson(SandboxSpecSchema, runtimeSpec);
}
