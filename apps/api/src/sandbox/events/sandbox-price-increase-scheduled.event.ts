/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../common/values/micro-usd.value';
import type { Sandbox } from '../entities/sandbox.entity';
import { SandboxEvent } from './sandbox.event';

export class SandboxPriceIncreaseScheduledEvent extends SandboxEvent {
	readonly placementPriceId: string;
	readonly priceIncreaseAt: Date;
	readonly currentHourlyMicroUsd: string;
	readonly newHourlyMicroUsd: string;

	constructor(
		sandbox: Sandbox,
		placementPriceId: string,
		priceIncreaseAt: Date,
		current: MicroUsd,
		next: MicroUsd
	) {
		super(sandbox);
		this.placementPriceId = placementPriceId;
		this.priceIncreaseAt = priceIncreaseAt;
		this.currentHourlyMicroUsd = current.toString();
		this.newHourlyMicroUsd = next.toString();
	}
}
