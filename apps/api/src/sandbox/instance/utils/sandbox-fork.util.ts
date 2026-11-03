/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	applyPlacement,
	placementRequest,
} from '../../placement/utils/sandbox-placement.util';
import type { ForkSandboxDto } from '../dto/fork-sandbox.dto';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxState } from '../enums/sandbox-state.enum';

export function buildForkedSandbox(
	sourceSandbox: Sandbox,
	organizationId: string,
	name: ForkSandboxDto['name']
): Sandbox {
	const forked = new Sandbox({ name });
	forked.locateOn(sourceSandbox);
	forked.organizationId = organizationId;
	forked.sandboxClass = sourceSandbox.sandboxClass;
	forked.mode = sourceSandbox.mode;
	forked.capabilities = [...sourceSandbox.capabilities];
	forked.snapshot = sourceSandbox.snapshot;
	forked.osUser = sourceSandbox.osUser;
	forked.env = { ...sourceSandbox.env };
	forked.labels = { ...sourceSandbox.labels };
	forked.cpu = sourceSandbox.cpu;
	forked.mem = sourceSandbox.mem;
	forked.disk = sourceSandbox.disk;
	forked.gpu = sourceSandbox.gpu;
	forked.gpuType = sourceSandbox.gpuType ?? null;
	forked.autoStopInterval = sourceSandbox.autoStopInterval;
	forked.autoArchiveInterval = sourceSandbox.autoArchiveInterval;
	forked.autoDeleteInterval = sourceSandbox.autoDeleteInterval;
	forked.volumes = sourceSandbox.volumes?.map((volume) => ({
		...volume,
	}));
	forked.networkBlockAll = sourceSandbox.networkBlockAll;
	forked.networkAllowList = sourceSandbox.networkAllowList;
	forked.domainAllowList = sourceSandbox.domainAllowList;
	forked.egressBandwidthBps = sourceSandbox.egressBandwidthBps;
	forked.machineId = sourceSandbox.machineId;
	applyPlacement(forked, { request: placementRequest(sourceSandbox) });
	forked.pending = true;
	forked.state = SandboxState.CREATING;
	return forked;
}
