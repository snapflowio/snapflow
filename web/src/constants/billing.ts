/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const BILLING_RATES = {
	/** vCPU per second */
	CPU_PER_SECOND: 0.0000389, // ~$0.14/hr
	/** Memory (GiB) per second */
	MEMORY_PER_SECOND: 0.0000139, // ~$0.05/hr
	/** Disk (GiB) per second */
	DISK_PER_SECOND: 0.00000222, // ~$0.008/hr
	/** GPU per second */
	GPU_PER_SECOND: 0.000694, // ~$2.50/hr
} as const;

/**
 * Billing tiers — wallet balance thresholds that unlock higher limits.
 * Each tier defines the minimum monthly wallet balance required.
 */
export const BILLING_TIERS = {
	FREE: {
		id: 'free',
		name: 'Free',
		minWalletBalance: 0,
		maxConcurrentSandboxes: 3,
		maxSandboxLifetimeSeconds: 3600, // 1 hour
		maxMemoryPerSandbox: 512, // MB
		maxCpuPerSandbox: 2,
		maxDiskPerSandbox: 2, // GB
		maxStorageTotal: 6, // GB
		bucketQuota: 3,
	},
	PRO: {
		id: 'pro',
		name: 'Pro',
		minWalletBalance: 10, // $10
		maxConcurrentSandboxes: 25,
		maxSandboxLifetimeSeconds: 86400, // 24 hours
		maxMemoryPerSandbox: 8192, // MB
		maxCpuPerSandbox: 4,
		maxDiskPerSandbox: 50, // GB
		maxStorageTotal: 50, // GB
		bucketQuota: 10,
	},
	ELITE: {
		id: 'elite',
		name: 'Elite',
		minWalletBalance: 100, // $100
		maxConcurrentSandboxes: 100,
		maxSandboxLifetimeSeconds: 259200, // 72 hours
		maxMemoryPerSandbox: 32768, // MB
		maxCpuPerSandbox: 16,
		maxDiskPerSandbox: 500, // GB
		maxStorageTotal: 500, // GB
		bucketQuota: 50,
	},
	MAX: {
		id: 'max',
		name: 'Max',
		minWalletBalance: 500, // $500
		maxConcurrentSandboxes: 500,
		maxSandboxLifetimeSeconds: -1, // unlimited
		maxMemoryPerSandbox: 65536, // MB
		maxCpuPerSandbox: 32,
		maxDiskPerSandbox: 2000, // GB
		maxStorageTotal: 2000, // GB
		bucketQuota: 200,
	},
	ENTERPRISE: {
		id: 'enterprise',
		name: 'Enterprise',
		minWalletBalance: -1, // custom
		maxConcurrentSandboxes: -1, // unlimited
		maxSandboxLifetimeSeconds: -1,
		maxMemoryPerSandbox: -1,
		maxCpuPerSandbox: -1,
		maxDiskPerSandbox: -1,
		maxStorageTotal: -1,
		bucketQuota: -1,
	},
} as const;

export type BillingTierId = keyof typeof BILLING_TIERS;
export type BillingTier = (typeof BILLING_TIERS)[BillingTierId];

export function getTierForBalance(balance: number): BillingTier {
	if (balance >= BILLING_TIERS.MAX.minWalletBalance) return BILLING_TIERS.MAX;
	if (balance >= BILLING_TIERS.ELITE.minWalletBalance)
		return BILLING_TIERS.ELITE;
	if (balance >= BILLING_TIERS.PRO.minWalletBalance) return BILLING_TIERS.PRO;
	return BILLING_TIERS.FREE;
}

export function calculateUsageCost(
	durationSeconds: number,
	cpu: number,
	memoryMb: number,
	diskGb: number,
	gpu: number
): number {
	const memoryGb = memoryMb / 1024;
	return (
		cpu * durationSeconds * BILLING_RATES.CPU_PER_SECOND +
		memoryGb * durationSeconds * BILLING_RATES.MEMORY_PER_SECOND +
		diskGb * durationSeconds * BILLING_RATES.DISK_PER_SECOND +
		gpu * durationSeconds * BILLING_RATES.GPU_PER_SECOND
	);
}

/** Per-hour rates derived from per-second constants */
export const HOURLY_RATES = {
	CPU: BILLING_RATES.CPU_PER_SECOND * 3600,
	MEMORY: BILLING_RATES.MEMORY_PER_SECOND * 3600,
	DISK: BILLING_RATES.DISK_PER_SECOND * 3600,
	GPU: BILLING_RATES.GPU_PER_SECOND * 3600,
} as const;

/** Calculate hourly cost for a sandbox preset (includes 2 GB disk) */
export function presetHourlyCost(cpu: number, memoryMb: number): number {
	return (
		cpu * HOURLY_RATES.CPU +
		(memoryMb / 1024) * HOURLY_RATES.MEMORY +
		2 * HOURLY_RATES.DISK
	);
}

export function formatRate(amount: number): string {
	if (amount < 0.01) return `$${amount.toFixed(3)}`;
	return `$${amount.toFixed(2)}`;
}

export function formatDollars(amount: number): string {
	if (amount !== 0 && Math.abs(amount) < 0.01) {
		return `$${amount.toFixed(4)}`;
	}
	return `$${amount.toFixed(2)}`;
}
