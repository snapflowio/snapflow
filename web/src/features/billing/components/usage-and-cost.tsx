/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { UsageOverview } from '@snapflow/api-client';
import { BarChart3 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/api/api-client';
import { Skeleton } from '@/components/ui';
import { useSelectedOrganization } from '@/hooks/use-selected-organization';
import { handleApiError } from '@/lib/errors';
import { cn } from '@/lib/utils';

interface MeterProps {
	label: string;
	current: number;
	total: number;
	unit: string;
	formatValue?: (v: number) => string;
}

function Meter({ label, current, total, unit, formatValue }: MeterProps) {
	const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
	const fmt = formatValue ?? ((v: number) => `${v} ${unit}`);
	return (
		<div className="flex flex-1 flex-col gap-1.5">
			<div className="flex items-center justify-between">
				<span className="text-[11px] text-text-muted">{label}</span>
				<span
					className={cn(
						'text-[11px]',
						pct > 90 ? 'text-red-400' : 'text-text-secondary'
					)}
				>
					{fmt(current)} / {fmt(total)}
				</span>
			</div>
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-4">
				<div
					className={cn(
						'h-full rounded-full transition-all duration-700',
						pct > 90
							? 'bg-red-500'
							: pct > 60
								? 'bg-amber-400'
								: 'bg-emerald-500'
					)}
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}

export function UsageAndCost() {
	const { selectedOrganization } = useSelectedOrganization();
	const [usage, setUsage] = useState<UsageOverview | null>(null);
	const [loading, setLoading] = useState(true);

	const fetchUsage = useCallback(async () => {
		if (!selectedOrganization) {
			return;
		}

		try {
			const response =
				await apiClient.organizationsApi.getOrganizationUsageOverview(
					selectedOrganization.id
				);
			setUsage(response.data);
		} catch (error) {
			handleApiError(error, 'Failed to fetch usage');
		} finally {
			setLoading(false);
		}
	}, [selectedOrganization]);

	useEffect(() => {
		fetchUsage();
		const interval = setInterval(fetchUsage, 10_000);
		return () => clearInterval(interval);
	}, [fetchUsage]);

	return (
		<div className="rounded-lg border border-border">
			<div className="flex items-center justify-between border-border border-b px-5 py-3">
				<div className="flex items-center gap-2">
					<BarChart3 className="h-3.5 w-3.5 text-text-icon" />
					<span className="font-medium text-[13px] text-text-body">
						Resource Usage
					</span>
				</div>
			</div>

			{loading ? (
				<div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:gap-8">
					{Array.from({ length: 3 }, (_, i) => `meter-${i}`).map((id) => (
						<div key={id} className="flex flex-1 flex-col gap-1.5">
							<div className="flex items-center justify-between">
								<Skeleton className="h-3 w-16" />
								<Skeleton className="h-3 w-20" />
							</div>
							<Skeleton className="h-1.5 w-full rounded-full" />
						</div>
					))}
				</div>
			) : usage ? (
				<div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:gap-8">
					<Meter
						label="Compute"
						current={usage.currentCpuUsage}
						total={usage.totalCpuQuota}
						unit="vCPU"
					/>
					<Meter
						label="Memory"
						current={usage.currentMemoryUsage}
						total={usage.totalMemoryQuota}
						unit="MB"
						formatValue={(mb) =>
							mb >= 1024
								? `${Math.round((mb / 1024) * 10) / 10} GB`
								: `${mb} MB`
						}
					/>
					<Meter
						label="Storage"
						current={usage.currentDiskUsage}
						total={usage.totalDiskQuota}
						unit="GB"
					/>
				</div>
			) : (
				<div className="flex items-center justify-center px-5 py-8">
					<span className="text-[13px] text-text-secondary">
						Unable to load usage data
					</span>
				</div>
			)}
		</div>
	);
}
