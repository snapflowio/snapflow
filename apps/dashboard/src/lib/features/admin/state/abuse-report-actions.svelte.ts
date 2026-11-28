/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Gavel from '@lucide/svelte/icons/gavel';
import MailCheck from '@lucide/svelte/icons/mail-check';
import Scale from '@lucide/svelte/icons/scale';
import type {
	AbuseCase,
	AbuseCaseAction,
	AbuseReportDetail,
} from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import {
	type AbuseReportDecisionInput,
	applyAbuseCaseActionMutationOptions,
	decideAbuseReportMutationOptions,
	recordAbuseCourtActionMutationOptions,
	recordCounterNoticeForwardedMutationOptions,
} from '#lib/api/admin/abuse-reports.ts';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import {
	ABUSE_CASE_ACTION_ICON,
	ABUSE_CASE_ACTION_LABEL,
	ABUSE_CASE_ACTIONS,
	canRecordCounterNoticeForwarded,
	canRecordCourtAction,
	caseActionAppliedAt,
	isDecidedReport,
	isOpenAbuseCase,
} from '#lib/features/admin/lib/abuse-reports-list.ts';

export interface PendingCaseAction {
	abuseCase: AbuseCase;
	action: AbuseCaseAction;
}

function createDecideMutation(reportId: () => string) {
	return createMutation(() => decideAbuseReportMutationOptions(reportId()));
}

function createActionMutation(reportId: () => string) {
	return createMutation(() => applyAbuseCaseActionMutationOptions(reportId()));
}

function createCourtActionMutation(reportId: () => string) {
	return createMutation(() =>
		recordAbuseCourtActionMutationOptions(reportId())
	);
}

function createForwardedMutation(reportId: () => string) {
	return createMutation(() =>
		recordCounterNoticeForwardedMutationOptions(reportId())
	);
}

export class AbuseReportActions {
	readonly decideMutation: ReturnType<typeof createDecideMutation>;
	readonly actionMutation: ReturnType<typeof createActionMutation>;
	readonly courtActionMutation: ReturnType<typeof createCourtActionMutation>;
	readonly forwardedMutation: ReturnType<typeof createForwardedMutation>;

	deciding = $state(false);
	pendingAction = $state.raw<PendingCaseAction | null>(null);

	constructor(reportId: () => string) {
		this.decideMutation = createDecideMutation(reportId);
		this.actionMutation = createActionMutation(reportId);
		this.courtActionMutation = createCourtActionMutation(reportId);
		this.forwardedMutation = createForwardedMutation(reportId);
	}

	ladderActions = (detail: AbuseReportDetail): ResourceRowAction[] => {
		const abuseCase = detail.abuseCase;
		if (!abuseCase || !isOpenAbuseCase(abuseCase)) return [];
		return ABUSE_CASE_ACTIONS.filter(
			(action) => caseActionAppliedAt(abuseCase, action) === null
		).map((action) => ({
			icon: ABUSE_CASE_ACTION_ICON[action],
			label: ABUSE_CASE_ACTION_LABEL[action],
			onSelect: () => {
				this.pendingAction = { abuseCase, action };
			},
		}));
	};

	headerActions = (detail: AbuseReportDetail): HeaderAction[] => [
		{
			id: 'decide',
			label: 'Record decision',
			kind: 'primary',
			icon: Gavel,
			onSelect: () => {
				this.deciding = true;
			},
			visible: !isDecidedReport(detail.report),
		},
		{
			id: 'counter-notice-forwarded',
			label: 'Record complainant copy sent',
			kind: 'secondary',
			icon: MailCheck,
			onSelect: () => {
				this.forwardedMutation.mutate();
			},
			visible: canRecordCounterNoticeForwarded(detail.report),
		},
		{
			id: 'court-action',
			label: 'Record court action',
			kind: 'secondary',
			icon: Scale,
			onSelect: () => {
				this.courtActionMutation.mutate();
			},
			visible: canRecordCourtAction(detail.report),
		},
	];

	decide = (body: AbuseReportDecisionInput['body']): void => {
		this.decideMutation.mutate(body, {
			onSuccess: () => {
				this.deciding = false;
			},
		});
	};

	applyAction = (
		pending: PendingCaseAction,
		note: string | undefined
	): void => {
		this.actionMutation.mutate(
			{
				path: { caseId: pending.abuseCase.id },
				body: { action: pending.action, note },
			},
			{
				onSuccess: () => {
					this.pendingAction = null;
				},
			}
		);
	};

	closeDecision = (): void => {
		this.deciding = false;
	};

	closeAction = (): void => {
		this.pendingAction = null;
	};
}
