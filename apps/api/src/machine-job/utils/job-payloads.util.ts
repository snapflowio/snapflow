/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	create,
	type DescMessage,
	type MessageInitShape,
	toJsonString,
} from '@bufbuild/protobuf';
import {
	BackupVolumesPayloadSchema,
	BuildSnapshotPayloadSchema,
	CreateBackupPayloadSchema,
	InspectSnapshotPayloadSchema,
	PublishSnapshotPayloadSchema,
	type Registry,
	SnapshotSandboxPayloadSchema,
	type VolumeBackupRequest,
} from '@snapflow/machine-proto';
import {
	type RegistryCredentials,
	registryMessage,
} from '../../docker-registry/utils/registry-message.util';

interface BuildSnapshotPayloadInput {
	snapshot: string;
	dockerfile?: string;
	ownerId: string;
	contexts: { hash: string; downloadUrl: string }[];
	buildLogUploadUrl: string;
	pushToInternalRegistry?: boolean;
	sourceRegistries?: RegistryCredentials[];
	registry?: RegistryCredentials;
	cacheRegistry: RegistryCredentials;
}

interface PublishSnapshotPayloadInput {
	sourceRef: string;
	sourceRegistry?: RegistryCredentials;
	destinationRef: string;
	destinationRegistry: RegistryCredentials;
}

function encode<Desc extends DescMessage>(
	schema: Desc,
	init: MessageInitShape<Desc>
): string {
	return toJsonString(schema, create(schema, init));
}

function optionalRegistryMessage(
	credentials: RegistryCredentials | undefined
): Registry | undefined {
	return credentials ? registryMessage(credentials) : undefined;
}

export function snapshotSandboxPayload(
	name: string,
	registry: RegistryCredentials,
	assignmentGeneration: number
): string {
	return encode(SnapshotSandboxPayloadSchema, {
		name,
		registry: registryMessage(registry),
		assignmentGeneration,
	});
}

export function createBackupPayload(
	snapshot: string,
	registry: RegistryCredentials,
	volumeBackups: VolumeBackupRequest[],
	assignmentGeneration: number
): string {
	return encode(CreateBackupPayloadSchema, {
		snapshot,
		registry: registryMessage(registry),
		volumeBackups,
		assignmentGeneration,
	});
}

export function backupVolumesPayload(
	volumeBackups: VolumeBackupRequest[],
	assignmentGeneration: number
): string {
	return encode(BackupVolumesPayloadSchema, {
		volumeBackups,
		assignmentGeneration,
	});
}

export function buildSnapshotPayload(input: BuildSnapshotPayloadInput): string {
	return encode(BuildSnapshotPayloadSchema, {
		snapshot: input.snapshot,
		dockerfile: input.dockerfile,
		ownerId: input.ownerId,
		contexts: input.contexts,
		buildLogUploadUrl: input.buildLogUploadUrl,
		pushToInternalRegistry: input.pushToInternalRegistry,
		sourceRegistries: input.sourceRegistries?.map(registryMessage),
		registry: optionalRegistryMessage(input.registry),
		cacheRegistry: registryMessage(input.cacheRegistry),
	});
}

export function publishSnapshotPayload(
	input: PublishSnapshotPayloadInput
): string {
	return encode(PublishSnapshotPayloadSchema, {
		sourceRef: input.sourceRef,
		sourceRegistry: optionalRegistryMessage(input.sourceRegistry),
		destinationRef: input.destinationRef,
		destinationRegistry: registryMessage(input.destinationRegistry),
	});
}

export function inspectSnapshotPayload(
	snapshot: string,
	registry?: RegistryCredentials
): string {
	return encode(InspectSnapshotPayloadSchema, {
		snapshot,
		registry: optionalRegistryMessage(registry),
	});
}
