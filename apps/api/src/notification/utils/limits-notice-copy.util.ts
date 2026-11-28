/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { countLabel } from '../../common/utils/count-label.util';
import { LimitsNoticeKind } from '../../organization/constants/organization-quota-tier.constants';
import type { LimitsNotice } from '../../organization/events/limits-notice.event';
import { DASHBOARD_NOTICE_PATH } from '../constants/notice.constants';
import type { NoticeAction, NoticeCopy } from '../types/notice.types';

const VIEW_LIMITS: NoticeAction = {
	label: 'View limits',
	path: DASHBOARD_NOTICE_PATH.SETTINGS_LIMITS,
};

function requestedAmounts(
	notice: Extract<LimitsNotice, { requestId: string }>
): string {
	return `${countLabel(notice.cpu, 'vCPU')}, ${notice.memory} GiB of memory, ${notice.disk} GiB of disk and ${countLabel(notice.gpu, 'GPU')} for ${notice.sandboxClass} sandboxes`;
}

export function limitsNoticeCopy(
	organizationName: string,
	notice: LimitsNotice
): NoticeCopy {
	switch (notice.kind) {
		case LimitsNoticeKind.TIER_UPGRADED:
			return {
				subject: `${organizationName}: limits raised to Tier ${notice.tier}`,
				heading: `You reached Tier ${notice.tier}`,
				paragraphs: [
					`${organizationName} moved from Tier ${notice.previousTier} to Tier ${notice.tier}, so its sandboxes may now use more CPU, memory, disk and GPUs.`,
				],
				note: 'The limits page shows the new limits and what unlocks the next tier.',
				action: VIEW_LIMITS,
			};
		case LimitsNoticeKind.INCREASE_APPROVED:
			return {
				subject: `${organizationName}: higher limits approved`,
				heading: 'Your limit increase was approved',
				paragraphs: [
					`${organizationName} may now use ${requestedAmounts(notice)}.`,
				],
				note: 'The new limits apply to sandboxes you create or start from now on.',
				action: VIEW_LIMITS,
			};
		case LimitsNoticeKind.INCREASE_DENIED:
			return {
				subject: `${organizationName}: limit increase declined`,
				heading: 'Your limit increase was declined',
				paragraphs: [
					`The request for ${requestedAmounts(notice)} was declined.`,
					`Reason: ${notice.reason}`,
				],
				note: 'You can send a new request with more detail about your use case.',
				action: VIEW_LIMITS,
			};
		case LimitsNoticeKind.STORAGE_CAP_REACHED:
			return {
				subject: `${organizationName}: storage limit reached`,
				heading: 'Your Snapflow storage is full',
				paragraphs: [
					`${organizationName} stores ${notice.storedGib} GiB of its ${notice.capGib} GiB limit.`,
					'New snapshots and volume backups are paused, and stopped sandboxes are not archived until space is freed.',
				],
				note: 'Delete snapshots, templates, volume backups or archived sandboxes, or ask for a higher limit.',
				action: VIEW_LIMITS,
			};
	}
}
