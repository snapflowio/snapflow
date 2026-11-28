/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Copy from '@lucide/svelte/icons/copy';
import FileSearch from '@lucide/svelte/icons/file-search';
import type { AbuseReport } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { adminAllAbuseReportsQueryOptions } from '#lib/api/admin/abuse-reports.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import {
	ABUSE_REPORT_CATEGORY_LABEL,
	ABUSE_REPORT_CATEGORY_OPTIONS,
	ABUSE_REPORT_FILTER_KEYS,
	ABUSE_REPORT_SORT_OPTIONS,
	ABUSE_REPORT_STATUS_OPTIONS,
	abuseReportsSearchSchema,
	reportTarget,
} from '#lib/features/admin/lib/abuse-reports-list.ts';
import { adminFilter } from '#lib/features/admin/lib/admin-filters.ts';
import {
	copyId,
	matchesFilter,
	matchesSearch,
} from '#lib/features/admin/lib/admin-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export class AbuseReportsList {
	readonly #params = new SearchParams(abuseReportsSearchSchema);

	readonly controls = new AdminListControls(this.#params, {
		sortOptions: ABUSE_REPORT_SORT_OPTIONS,
		filterKeys: ABUSE_REPORT_FILTER_KEYS,
		filterFields: () => [
			adminFilter({
				id: 'status',
				label: 'Status',
				options: ABUSE_REPORT_STATUS_OPTIONS,
				values: this.#params.current.status,
				onChange: (status) => void this.#params.update({ status }),
			}),
			adminFilter({
				id: 'category',
				label: 'Category',
				options: ABUSE_REPORT_CATEGORY_OPTIONS,
				values: this.#params.current.category,
				onChange: (category) => void this.#params.update({ category }),
			}),
		],
	});
	readonly reportsQuery = createQuery(() => adminAllAbuseReportsQueryOptions());

	readonly #allReports: readonly AbuseReport[] = $derived.by(
		() => this.reportsQuery.data ?? []
	);
	readonly #reportsById = $derived.by(
		() => new Map(this.#allReports.map((report) => [report.id, report]))
	);
	readonly reports: readonly AbuseReport[] = $derived.by(() =>
		this.#allReports.filter(
			(report) =>
				matchesSearch(this.controls.search.value, [
					report.id,
					reportTarget(report),
					report.description ?? '',
					report.reporterEmail ?? '',
					report.sandboxId ?? '',
					report.organizationId ?? '',
					report.machineId ?? '',
					report.abuseCaseId ?? '',
					ABUSE_REPORT_CATEGORY_LABEL[report.category],
				]) &&
				matchesFilter(this.#params.current.status, report.status) &&
				matchesFilter(this.#params.current.category, report.category)
		)
	);

	openReport = (reportId: string): void => {
		void goto(
			resolve('/(app)/(dashboard)/admin/abuse/reports/[reportId]', {
				reportId,
			})
		);
	};

	reportActions = (report: AbuseReport): ResourceRowAction[] => [
		{
			icon: FileSearch,
			label: 'Open report',
			onSelect: () => this.openReport(report.id),
		},
		{
			icon: Copy,
			label: 'Copy report ID',
			onSelect: () => copyId(report.id),
		},
		{
			icon: Copy,
			label: 'Copy sandbox ID',
			onSelect: () => {
				if (report.sandboxId) copyId(report.sandboxId);
			},
			visible: report.sandboxId !== null,
		},
	];

	reportRowActions = (reportId: string): ResourceRowAction[] => {
		const report = this.#reportsById.get(reportId);
		return report ? this.reportActions(report) : [];
	};
}
