/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { create, fromJsonString, toJsonString } from '@bufbuild/protobuf';
import { BadRequestException } from '@nestjs/common';
import {
	MachineSnapshotInventorySchema,
	type ObservedSnapshot,
	SnapshotInventoryState,
	SnapshotRegistryCredentialsSchema,
} from '@snapflow/machine-proto';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { truncateErrorMessage } from '../../../../common/utils/error/truncate-error-message.util';
import {
	type RegistryCredentials,
	registryMessage,
} from '../../../../docker-registry/persistence/utils/registry-message.util';
import { SandboxCapability } from '../../../instance/enums/sandbox-capability.enum';
import type { PreparedSnapshotTemplate } from '../../../snapshot/entities/snapshot-machine.entity';
import { SnapshotMachineState } from '../../../snapshot/enums/snapshot-machine-state.enum';
import { MACHINE_SNAPSHOT_INVENTORY_LIMITS } from '../../constants/machine-snapshot.constants';

const INVENTORY_STATES: ReadonlyMap<
	SnapshotInventoryState,
	SnapshotMachineState
> = new Map([
	[SnapshotInventoryState.PRESENT, SnapshotMachineState.PRESENT],
	[SnapshotInventoryState.PULLING, SnapshotMachineState.PULLING],
	[SnapshotInventoryState.FAILED, SnapshotMachineState.FAILED],
]);

const SANDBOX_CAPABILITIES = new Set<string>(Object.values(SandboxCapability));

export interface InventorySnapshot {
	snapshotRef: string;
	state: SnapshotMachineState;
	digest: string | null;
	sizeBytes: number;
	errorReason: string | null;
	preparedTemplate: PreparedSnapshotTemplate | null;
}

export function decodeSnapshotInventory(encoded: string): InventorySnapshot[] {
	let snapshots: ObservedSnapshot[];
	try {
		snapshots = fromJsonString(
			MachineSnapshotInventorySchema,
			encoded
		).snapshots;
	} catch (error) {
		throw new BadRequestException(
			`Report is not a machine.v1alpha1.MachineSnapshotInventory: ${errorMessage(error)}`
		);
	}
	if (
		snapshots.length >
		MACHINE_SNAPSHOT_INVENTORY_LIMITS.maximumSnapshotsPerReport
	) {
		throw new BadRequestException(
			`A report carries at most ${MACHINE_SNAPSHOT_INVENTORY_LIMITS.maximumSnapshotsPerReport} snapshots`
		);
	}
	const refs = new Set<string>();
	return snapshots.map((snapshot) => {
		if (!snapshot.ref || refs.has(snapshot.ref)) {
			throw new BadRequestException(
				`Snapshot reference "${snapshot.ref}" is empty or reported twice`
			);
		}
		refs.add(snapshot.ref);
		return inventorySnapshot(snapshot);
	});
}

function inventorySnapshot(snapshot: ObservedSnapshot): InventorySnapshot {
	const state = INVENTORY_STATES.get(snapshot.state);
	if (!state) {
		throw new BadRequestException(`Snapshot ${snapshot.ref} has no state`);
	}
	if (snapshot.sizeBytes < 0n) {
		throw new BadRequestException(
			`Snapshot ${snapshot.ref} has a negative size`
		);
	}
	return {
		snapshotRef: snapshot.ref,
		state,
		digest: snapshot.digest ?? null,
		sizeBytes: Number(snapshot.sizeBytes),
		errorReason: snapshot.errorReason
			? truncateErrorMessage(
					snapshot.errorReason,
					MACHINE_SNAPSHOT_INVENTORY_LIMITS.maximumErrorReasonLength
				)
			: null,
		preparedTemplate: preparedTemplate(snapshot),
	};
}

function preparedTemplate(
	snapshot: ObservedSnapshot
): PreparedSnapshotTemplate | null {
	const template = snapshot.template;
	if (!template) return null;
	const capabilities = template.capabilities.filter(
		(capability): capability is SandboxCapability =>
			SANDBOX_CAPABILITIES.has(capability)
	);
	if (!template.key || capabilities.length !== template.capabilities.length) {
		throw new BadRequestException(
			`Snapshot ${snapshot.ref} reports an invalid prepared template`
		);
	}
	return {
		key: template.key,
		cpuQuota: template.cpuQuota,
		memoryQuota: template.memoryQuota,
		storageQuota: template.storageQuota,
		capabilities: capabilities.sort(),
	};
}

export function encodeSnapshotRegistryCredentials(
	registryId: string,
	registry: RegistryCredentials
): string {
	return toJsonString(
		SnapshotRegistryCredentialsSchema,
		create(SnapshotRegistryCredentialsSchema, {
			registryId,
			registry: registryMessage(registry),
		})
	);
}
