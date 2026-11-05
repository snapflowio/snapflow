/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const BILLING_POLICY = {
	version: 2,
	quoteTtlSeconds: 30,
	accountingWindowMinutes: 15,
	minimumRunwayMinutes: 60,
	reservationRenewalMinutes: 15,
	suspensionGraceMinutes: 15,
	networkReserveHistoryDays: 7,
	networkReserveMinimumMicroUsd: '100000',
} as const;
