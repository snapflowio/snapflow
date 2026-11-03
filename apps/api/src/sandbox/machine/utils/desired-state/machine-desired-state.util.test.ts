/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	create,
	type DescField,
	type DescMessage,
	toJsonString,
} from '@bufbuild/protobuf';
import {
	MachineDesiredStateSchema,
	RegistrySchema,
	SandboxImageSchema,
	SandboxLifecycle,
	SandboxSpecSchema,
} from '@snapflow/machine-proto';
import { SandboxMode } from '../../../instance/enums/sandbox-mode.enum';
import { protoJsonDigest } from '../proto/proto-json.util';
import {
	runtimeIntentUpdate,
	type SandboxRuntimeIntent,
} from '../proto/sandbox-runtime-intent.util';
import {
	buildSandboxSpec,
	type SandboxSpecFields,
} from '../proto/sandbox-runtime-spec.util';
import {
	type DesiredSandboxRecord,
	machineDesiredStateDocument,
} from './machine-desired-state.util';

const GENERATED_AT = new Date('2026-10-04T12:00:00.000Z');
const EXPIRES_AT = new Date('2026-10-04T13:00:00.000Z');
const REVISION = '7';
const FIRST_SANDBOX_ID = '1a000000-0000-4000-8000-000000000001';
const SECOND_SANDBOX_ID = '2b000000-0000-4000-8000-000000000002';
const SECRET_FIELD_NAMES = new Set(['secret_env', 'password', 'username']);

const SPEC_SANDBOX: SandboxSpecFields = {
	mode: SandboxMode.EPHEMERAL,
	capabilities: [],
	name: 'unit',
	organizationId: 'c0ffee00-0000-4000-8000-000000000001',
	osUser: 'snapflow',
	cpu: 1,
	gpu: 0,
	mem: 1,
	disk: 3,
	env: { MODE: 'test' },
	volumes: [],
	networkBlockAll: true,
	networkAllowList: null,
	domainAllowList: null,
	egressBandwidthBps: null,
	networkThrottleBandwidthBps: null,
	linkedSandboxId: null,
};

function record(
	sandboxId: string,
	imageRef: string,
	intent: Omit<SandboxRuntimeIntent, 'spec'> = {
		lifecycle: SandboxLifecycle.STARTED,
	}
): DesiredSandboxRecord {
	const update = runtimeIntentUpdate(
		{ specGeneration: 0 },
		{
			...intent,
			spec: buildSandboxSpec({
				sandbox: SPEC_SANDBOX,
				source: {
					case: 'image',
					value: create(SandboxImageSchema, { ref: imageRef }),
				},
				fencedVolumes: new Map(),
				labels: {},
			}),
		}
	);
	if (!update.runtimeSpec || !update.runtimeSpecDigest) {
		throw new Error('The intent carries a spec');
	}
	return {
		sandboxId,
		assignmentGeneration: 1,
		specGeneration: update.specGeneration ?? 0,
		lifecycle: intent.lifecycle,
		runtimeSpec: update.runtimeSpec,
		runtimeSpecDigest: update.runtimeSpecDigest,
		runtimeDirectives: update.runtimeDirectives ?? null,
		hasSecrets: false,
	};
}

function document(sandboxes: DesiredSandboxRecord[]) {
	return machineDesiredStateDocument({
		revision: REVISION,
		generatedAt: GENERATED_AT,
		expiresAt: EXPIRES_AT,
		sandboxes,
		snapshots: [],
	});
}

function fieldMessage(field: DescField): DescMessage | undefined {
	switch (field.fieldKind) {
		case 'message':
			return field.message;
		case 'list':
			return field.listKind === 'message' ? field.message : undefined;
		case 'map':
			return field.mapKind === 'message' ? field.message : undefined;
		default:
			return undefined;
	}
}

function reachableFields(
	message: DescMessage,
	visited = new Set<string>()
): DescField[] {
	if (visited.has(message.typeName)) return [];
	visited.add(message.typeName);
	return message.fields.flatMap((field) => {
		const nested = fieldMessage(field);
		return [field, ...(nested ? reachableFields(nested, visited) : [])];
	});
}

describe('machineDesiredStateDocument', () => {
	it('produces the same document and digest whatever the record order', () => {
		const first = record(FIRST_SANDBOX_ID, 'registry.example.com/a:1');
		const second = record(SECOND_SANDBOX_ID, 'registry.example.com/b:1');

		const forward = document([first, second]);
		const reversed = document([second, first]);

		assert.equal(forward.digest, reversed.digest);
		assert.equal(
			toJsonString(MachineDesiredStateSchema, forward),
			toJsonString(MachineDesiredStateSchema, reversed)
		);
		assert.deepEqual(
			forward.sandboxes.map(({ sandboxId }) => sandboxId),
			[FIRST_SANDBOX_ID, SECOND_SANDBOX_ID]
		);
	});

	it('digests the document with the digest unset', () => {
		const built = document([
			record(FIRST_SANDBOX_ID, 'registry.example.com/a:1'),
		]);
		const unsigned = create(MachineDesiredStateSchema, {
			...built,
			digest: '',
		});
		assert.equal(
			built.digest,
			protoJsonDigest(MachineDesiredStateSchema, unsigned)
		);
	});

	it('changes its digest when a listed spec changes', () => {
		const original = document([
			record(FIRST_SANDBOX_ID, 'registry.example.com/a:1'),
		]);
		const changed = document([
			record(FIRST_SANDBOX_ID, 'registry.example.com/a:2'),
		]);
		assert.notEqual(original.digest, changed.digest);
		assert.notEqual(
			original.sandboxes[0]?.specDigest,
			changed.sandboxes[0]?.specDigest
		);
	});

	it('carries one-shot directives only for the generation they were issued with', () => {
		const stopped = document([
			record(FIRST_SANDBOX_ID, 'registry.example.com/a:1', {
				lifecycle: SandboxLifecycle.STOPPED,
				directives: { forceStop: true },
			}),
		]);
		const started = document([
			record(FIRST_SANDBOX_ID, 'registry.example.com/a:1'),
		]);
		assert.equal(stopped.sandboxes[0]?.directives?.forceStop, true);
		assert.equal(started.sandboxes[0]?.directives, undefined);
	});

	it('cannot carry secrets or registry credentials', () => {
		const fields = reachableFields(MachineDesiredStateSchema);
		assert.deepEqual(
			fields.filter((field) => SECRET_FIELD_NAMES.has(field.name)),
			[]
		);
		const carriesRegistry = (field: DescField) =>
			fieldMessage(field)?.typeName === RegistrySchema.typeName;
		assert.equal(fields.some(carriesRegistry), false);
		assert.equal(
			reachableFields(SandboxSpecSchema).some(carriesRegistry),
			false
		);
	});
});
