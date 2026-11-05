/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { create, type JsonObject } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import {
	type DesiredSnapshot,
	type MachineDesiredState,
	MachineDesiredStateSchema,
	type SandboxDesiredState,
	SandboxDesiredStateSchema,
	type SandboxLifecycle,
} from '@snapflow/machine-proto';
import { protoJsonDigest } from '../proto/proto-json.util';
import { decodeSandboxDirectives } from '../proto/sandbox-runtime-intent.util';
import { decodeSandboxSpec } from '../proto/sandbox-runtime-spec.util';

export interface DesiredSandboxRecord {
	sandboxId: string;
	assignmentGeneration: number;
	specGeneration: number;
	lifecycle: SandboxLifecycle;
	runtimeSpec: JsonObject;
	runtimeSpecDigest: string;
	runtimeDirectives: JsonObject | null;
	hasSecrets: boolean;
}

export interface MachineDesiredStateInput {
	revision: string;
	generatedAt: Date;
	expiresAt: Date;
	sandboxes: readonly DesiredSandboxRecord[];
	snapshots: readonly DesiredSnapshot[];
}

function bySandboxId(
	left: DesiredSandboxRecord,
	right: DesiredSandboxRecord
): number {
	if (left.sandboxId === right.sandboxId) return 0;
	return left.sandboxId < right.sandboxId ? -1 : 1;
}

function sandboxDesiredState(
	record: DesiredSandboxRecord
): SandboxDesiredState {
	return create(SandboxDesiredStateSchema, {
		sandboxId: record.sandboxId,
		assignmentGeneration: record.assignmentGeneration,
		specGeneration: record.specGeneration,
		lifecycle: record.lifecycle,
		spec: decodeSandboxSpec(record.runtimeSpec),
		specDigest: record.runtimeSpecDigest,
		directives: record.runtimeDirectives
			? decodeSandboxDirectives(record.runtimeDirectives)
			: undefined,
		hasSecrets: record.hasSecrets,
	});
}

export function machineDesiredStateDocument(
	input: MachineDesiredStateInput
): MachineDesiredState {
	const document = create(MachineDesiredStateSchema, {
		revision: BigInt(input.revision),
		generatedAt: timestampFromDate(input.generatedAt),
		expiresAt: timestampFromDate(input.expiresAt),
		sandboxes: [...input.sandboxes].sort(bySandboxId).map(sandboxDesiredState),
		snapshots: [...input.snapshots],
	});
	document.digest = protoJsonDigest(MachineDesiredStateSchema, document);
	return document;
}
