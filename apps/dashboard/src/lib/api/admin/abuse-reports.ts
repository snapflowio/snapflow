/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AdminApplyAbuseCaseActionData,
	type AdminDecideAbuseReportData,
	adminApplyAbuseCaseAction,
	adminDecideAbuseReport,
	adminListAbuseReports,
	adminRecordAbuseCounterNoticeForwarded,
	adminRecordAbuseCourtAction,
} from '@snapflow/api-client';
import {
	adminGetAbuseReportOptions,
	adminGetAbuseReportQueryKey,
	adminListAbuseCasesQueryKey,
	adminListAbuseReportsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';
import { allPagesOptions } from '#lib/api/client/cursor-pagination.ts';

export type AbuseReportDecisionInput = Pick<
	AdminDecideAbuseReportData,
	'path' | 'body'
>;

export type AbuseCaseActionInput = Pick<
	AdminApplyAbuseCaseActionData,
	'path' | 'body'
>;

function reportInvalidates(reportId: string) {
	return [
		adminListAbuseReportsQueryKey(),
		adminGetAbuseReportQueryKey({ path: { reportId } }),
		adminListAbuseCasesQueryKey(),
	];
}

export function adminAllAbuseReportsQueryOptions() {
	return allPagesOptions(
		adminListAbuseReportsQueryKey(),
		async (cursor, signal) =>
			(await adminListAbuseReports({ query: { cursor }, signal })).data
	);
}

export function adminAbuseReportQueryOptions(reportId: string) {
	return adminGetAbuseReportOptions({ path: { reportId } });
}

export function decideAbuseReportMutationOptions(reportId: string) {
	return mutationOptions({
		mutationFn: (body: AbuseReportDecisionInput['body']) =>
			adminDecideAbuseReport({ path: { reportId }, body }),
		meta: {
			success: 'Decision recorded',
			failure: 'Failed to record the decision',
			invalidates: reportInvalidates(reportId),
		},
	});
}

export function applyAbuseCaseActionMutationOptions(reportId: string) {
	return mutationOptions({
		mutationFn: ({ path, body }: AbuseCaseActionInput) =>
			adminApplyAbuseCaseAction({ path, body }),
		meta: {
			success: 'Action applied',
			failure: 'Failed to apply the action',
			invalidates: reportInvalidates(reportId),
		},
	});
}

export function recordAbuseCourtActionMutationOptions(reportId: string) {
	return mutationOptions({
		mutationFn: () => adminRecordAbuseCourtAction({ path: { reportId } }),
		meta: {
			success: 'Court action recorded; the material stays down',
			failure: 'Failed to record the court action',
			invalidates: reportInvalidates(reportId),
		},
	});
}

export function recordCounterNoticeForwardedMutationOptions(reportId: string) {
	return mutationOptions({
		mutationFn: () =>
			adminRecordAbuseCounterNoticeForwarded({ path: { reportId } }),
		meta: {
			success: 'Forwarding recorded; the restoration can proceed',
			failure: 'Failed to record the forwarding',
			invalidates: reportInvalidates(reportId),
		},
	});
}
