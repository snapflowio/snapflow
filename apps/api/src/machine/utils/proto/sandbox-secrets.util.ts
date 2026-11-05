/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { create, toJsonString } from '@bufbuild/protobuf';
import { SandboxSecretsSchema } from '@snapflow/machine-proto';

export interface SandboxSecretsInput {
	sandboxId: string;
	assignmentGeneration: number;
	specGeneration: number;
	environment: Record<string, string>;
}

export function encodeSandboxSecrets(input: SandboxSecretsInput): string {
	return toJsonString(
		SandboxSecretsSchema,
		create(SandboxSecretsSchema, {
			sandboxId: input.sandboxId,
			assignmentGeneration: input.assignmentGeneration,
			specGeneration: input.specGeneration,
			env: input.environment,
		})
	);
}
