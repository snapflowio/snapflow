/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SandboxLease } from '../../../marketplace/machine/entities/sandbox-lease.entity';
import type { Sandbox } from '../entities/sandbox.entity';
import { SandboxEvent } from './sandbox.event';

export class SandboxLeaseRenewalRequiredEvent extends SandboxEvent {
	readonly leaseId: string;
	readonly renewalDeadline: Date;

	constructor(sandbox: Sandbox, lease: SandboxLease, renewalDeadline: Date) {
		super(sandbox);
		this.leaseId = lease.id;
		this.renewalDeadline = renewalDeadline;
	}
}
