/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const OFFER_CARD_COLUMNS_SQL = `card."vcpuHourMicroUsd"::text AS vcpu_hour_micro_usd,
	card."memoryGibHourMicroUsd"::text AS memory_gib_hour_micro_usd,
	card."gpuHourMicroUsd"::text AS gpu_hour_micro_usd,
	card."diskGibMonthMicroUsd"::text AS disk_gib_month_micro_usd,
	card.vcpu AS card_vcpu,
	card."memoryGib" AS card_memory_gib,
	card."gpuCount" AS card_gpu_count,
	card."interruptibleBasisPoints" AS card_interruptible_basis_points,
	listing."gpuOnly" AS gpu_only`;

export const CARD_MACHINE_HOUR_SQL = `(card.vcpu * card."vcpuHourMicroUsd" + card."memoryGib" * card."memoryGibHourMicroUsd" + card."gpuCount" * card."gpuHourMicroUsd")`;

export interface OfferCardRow {
	price_card_id: string | null;
	vcpu_hour_micro_usd: string | null;
	memory_gib_hour_micro_usd: string | null;
	gpu_hour_micro_usd: string | null;
	disk_gib_month_micro_usd: string | null;
	card_vcpu: number | null;
	card_memory_gib: number | null;
	card_gpu_count: number | null;
	card_interruptible_basis_points: number | null;
	gpu_only: boolean;
}
