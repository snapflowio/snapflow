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
	fromJson,
	type JsonObject,
	type MessageInitShape,
} from '@bufbuild/protobuf';
import {
	type SandboxDirectives,
	SandboxDirectivesSchema,
	SandboxLifecycle,
	type SandboxSpec,
} from '@snapflow/machine-proto';
import type { Sandbox } from '../../../sandbox/entities/sandbox.entity';
import { protoJsonObject } from './proto-json.util';
import { encodeSandboxSpec } from './sandbox-runtime-spec.util';

export interface SandboxRuntimeIntent {
	lifecycle: SandboxLifecycle;
	spec?: SandboxSpec;
	registryId?: string | null;
	directives?: MessageInitShape<typeof SandboxDirectivesSchema>;
}

export function inPlaceRecoveryIntent(
	sandbox: Pick<Sandbox, 'errorReason' | 'backupErrorReason'>
): SandboxRuntimeIntent {
	return {
		lifecycle: SandboxLifecycle.STOPPED,
		directives: {
			recovery: {
				errorReason: sandbox.errorReason ?? undefined,
				backupErrorReason: sandbox.backupErrorReason ?? undefined,
			},
		},
	};
}

type RuntimeIntentFields = Pick<
	Sandbox,
	| 'specGeneration'
	| 'runtimeLifecycle'
	| 'runtimeSpec'
	| 'runtimeSpecDigest'
	| 'runtimeDirectives'
	| 'runtimeRegistryId'
>;

export function runtimeIntentUpdate(
	sandbox: Pick<Sandbox, 'specGeneration'>,
	intent: SandboxRuntimeIntent
): Partial<RuntimeIntentFields> {
	const update: Partial<RuntimeIntentFields> = {
		specGeneration: sandbox.specGeneration + 1,
		runtimeLifecycle: intent.lifecycle,
		runtimeDirectives: encodeSandboxDirectives(intent.directives),
	};
	if (intent.spec) Object.assign(update, encodeSandboxSpec(intent.spec));
	if (intent.registryId !== undefined) {
		update.runtimeRegistryId = intent.registryId;
	}
	return update;
}

function encodeSandboxDirectives(
	init: MessageInitShape<typeof SandboxDirectivesSchema> | undefined
): JsonObject | null {
	if (!init) return null;
	const directives = create(SandboxDirectivesSchema, init);
	if (!directives.forceStop && !directives.recovery) return null;
	return protoJsonObject(SandboxDirectivesSchema, directives);
}

export function decodeSandboxDirectives(
	runtimeDirectives: JsonObject | null
): SandboxDirectives {
	return runtimeDirectives
		? fromJson(SandboxDirectivesSchema, runtimeDirectives)
		: create(SandboxDirectivesSchema);
}
