/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '../entities/sandbox.entity';

export type SandboxEventData = Readonly<
	Pick<
		Sandbox,
		| 'id'
		| 'organizationId'
		| 'sandboxClass'
		| 'snapshot'
		| 'cpu'
		| 'mem'
		| 'disk'
		| 'gpu'
		| 'volumes'
		| 'createdAt'
	>
>;

export abstract class SandboxEvent {
	readonly sandbox: SandboxEventData;

	constructor(sandbox: Sandbox) {
		this.sandbox = {
			id: sandbox.id,
			organizationId: sandbox.organizationId,
			sandboxClass: sandbox.sandboxClass,
			snapshot: sandbox.snapshot,
			cpu: sandbox.cpu,
			mem: sandbox.mem,
			disk: sandbox.disk,
			gpu: sandbox.gpu,
			volumes: sandbox.volumes.map((volume) => ({ ...volume })),
			createdAt: sandbox.createdAt,
		};
	}
}
