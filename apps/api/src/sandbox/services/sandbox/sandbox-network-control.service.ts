/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { equals } from '@bufbuild/protobuf';
import { Injectable } from '@nestjs/common';
import { NetworkPolicySchema, SandboxLifecycle } from '@snapflow/machine-proto';
import { sandboxNetworkPolicy } from '../../../machine/utils/proto/sandbox-runtime-spec.util';
import type { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import type { SandboxNetworkThrottle } from '../../types/sandbox-network-throttle.types';
import { SandboxRuntimeSpecService } from './sandbox-runtime-spec.service';

export type SandboxAbuseControls = Partial<
	Pick<
		Sandbox,
		| 'networkThrottleBandwidthBps'
		| 'networkThrottleConnectionsPerSecond'
		| 'abuseEgressBlock'
		| 'abuseHold'
	>
>;

export const RELEASED_ABUSE_CONTROLS = {
	networkThrottleBandwidthBps: null,
	networkThrottleConnectionsPerSecond: null,
	abuseEgressBlock: false,
	abuseHold: false,
} as const satisfies SandboxAbuseControls;

export function throttleControls(
	throttle: SandboxNetworkThrottle
): SandboxAbuseControls {
	return {
		networkThrottleBandwidthBps: throttle.bandwidthBps,
		networkThrottleConnectionsPerSecond: throttle.connectionsPerSecond,
	};
}

@Injectable()
export class SandboxNetworkControlService {
	constructor(
		private readonly sandboxRepository: SandboxRepository,
		private readonly runtimeSpecs: SandboxRuntimeSpecService
	) {}

	async applyAbuseControls(
		sandboxId: string,
		controls: SandboxAbuseControls
	): Promise<Sandbox> {
		const stored = await this.sandboxRepository.updateWhere(sandboxId, {
			updateData: controls,
			whereCondition: { state: { $ne: SandboxState.DESTROYED } },
		});
		return this.converge(stored);
	}

	async converge(sandbox: Sandbox): Promise<Sandbox> {
		if (sandbox.state !== SandboxState.STARTED || sandbox.pending) {
			return sandbox;
		}
		const desired = sandboxNetworkPolicy(sandbox);
		const spec = await this.runtimeSpecs.currentSpec(sandbox);
		if (spec.network && equals(NetworkPolicySchema, spec.network, desired)) {
			return sandbox;
		}
		spec.network = desired;
		return this.sandboxRepository.updateWhere(sandbox.id, {
			updateData: {},
			whereCondition: {
				state: SandboxState.STARTED,
				pending: false,
				specGeneration: sandbox.specGeneration,
			},
			runtimeIntent: { lifecycle: SandboxLifecycle.STARTED, spec },
		});
	}
}
