/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const NetworkingEvents = {
	EXPOSURE_RECONCILIATION_REQUESTED:
		'networking.exposure-reconciliation.requested',
	EXPOSURE_DNS_ACTIVATION_REQUESTED:
		'networking.exposure-dns-activation.requested',
	NETWORK_BUDGET_THRESHOLD_REACHED:
		'networking.network-budget.threshold-reached',
} as const;
