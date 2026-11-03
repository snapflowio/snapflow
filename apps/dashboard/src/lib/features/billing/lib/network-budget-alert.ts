/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { NetworkBudgetThresholdReached } from '#lib/integrations/notifications/notification-events.ts';
import { formatBasisPointsPercent } from '#lib/utils/format.ts';
import { formatUsd } from '#lib/utils/usd.ts';

export function networkBudgetAlertTitle(
	alert: NetworkBudgetThresholdReached
): string {
	return `Network budget ${formatBasisPointsPercent(alert.thresholdBasisPoints)} used`;
}

export function networkBudgetAlertDescription(
	alert: NetworkBudgetThresholdReached
): string {
	const spend = `${formatUsd(alert.spendMicroUsd)} of ${formatUsd(alert.limitMicroUsd)} egress this month.`;
	return alert.throttled
		? `${spend} New sandboxes are blocked and running sandboxes are throttled until the budget is raised or the month ends.`
		: spend;
}
