/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { SandboxBillableUsage } from '../entities/sandbox-billable-usage.entity';
import type { SandboxUsagePeriod } from '../entities/sandbox-usage-period.entity';

export abstract class UsagePeriodFinalizer {
	abstract finalize(
		manager: EntityManager,
		period: SandboxUsagePeriod
	): Promise<SandboxBillableUsage | null>;
}
