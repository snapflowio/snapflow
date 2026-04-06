/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Shield } from 'lucide-react';
import type { BillingTier } from '@/constants/billing';
import { cn } from '@/lib/utils';
import { fmtLife, fmtLimit, fmtMem } from '../utils/formatters';

const TIER_COLORS: Record<string, string> = {
	free: '#2ABBF8',
	pro: '#00F701',
	elite: '#FA4EDF',
	max: '#FFCC02',
	enterprise: '#FF6B2C',
};

interface TierComparisonTableProps {
	tiers: BillingTier[];
	currentTier: BillingTier;
}

const LIMIT_ROWS: { label: string; getValue: (t: BillingTier) => string }[] = [
	{
		label: 'Concurrent Sandboxes',
		getValue: (t) => fmtLimit(t.maxConcurrentSandboxes),
	},
	{
		label: 'Max Lifetime',
		getValue: (t) => fmtLife(t.maxSandboxLifetimeSeconds),
	},
	{ label: 'Max vCPUs', getValue: (t) => fmtLimit(t.maxCpuPerSandbox) },
	{ label: 'Max Memory', getValue: (t) => fmtMem(t.maxMemoryPerSandbox) },
	{
		label: 'Storage',
		getValue: (t) =>
			t.maxStorageTotal === -1 ? 'Custom' : `${t.maxStorageTotal} GB`,
	},
	{ label: 'Buckets', getValue: (t) => fmtLimit(t.bucketQuota) },
	{
		label: 'Min. Balance',
		getValue: (t) =>
			t.minWalletBalance === 0
				? 'Free'
				: t.minWalletBalance === -1
					? 'Custom'
					: `$${t.minWalletBalance}`,
	},
];

export function TierComparisonTable({
	tiers,
	currentTier,
}: TierComparisonTableProps) {
	return (
		<div className="mb-8 overflow-hidden rounded-lg border border-border">
			<div className="border-border border-b px-5 py-3">
				<div className="flex items-center gap-2">
					<Shield className="h-3.5 w-3.5 text-text-icon" />
					<span className="font-medium text-[13px] text-text-body">
						All Tiers
					</span>
				</div>
				<p className="mt-1 text-[11px] text-text-muted">
					Your tier is determined by your wallet balance. Add funds to unlock
					higher limits.
				</p>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full text-[12px]">
					<thead>
						<tr className="border-border border-b">
							<th className="sticky left-0 z-10 border-border border-r bg-bg px-4 py-2.5 text-left font-medium text-text-muted">
								Limit
							</th>
							{tiers.map((t) => {
								const isCurrent = t.id === currentTier.id;
								const color = TIER_COLORS[t.id] ?? '#999';
								return (
									<th
										key={t.id}
										className={cn(
											'px-4 py-2.5 text-center font-medium',
											isCurrent
												? 'bg-surface-active text-text-primary'
												: 'text-text-muted'
										)}
									>
										<div className="flex items-center justify-center gap-1.5">
											<span
												className="h-1.5 w-1.5 rounded-full"
												style={{ backgroundColor: color }}
											/>
											<span>{t.name}</span>
										</div>
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{LIMIT_ROWS.map((row) => (
							<tr
								key={row.label}
								className="border-border/40 border-b last:border-0"
							>
								<td className="sticky left-0 z-10 border-border border-r bg-bg px-4 py-2 text-text-secondary">
									{row.label}
								</td>
								{tiers.map((t) => (
									<td
										key={t.id}
										className={cn(
											'px-4 py-2 text-center',
											t.id === currentTier.id
												? 'bg-surface-active/50 text-text-primary'
												: 'text-text-muted'
										)}
									>
										{row.getValue(t)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
