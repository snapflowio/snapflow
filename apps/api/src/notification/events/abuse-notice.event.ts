/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AbuseSignalKind } from '../../abuse/constants/abuse.constants';
import type { AbuseReportCategory } from '../../abuse/constants/abuse-report.constants';
import type {
	AbuseNoticeAudience,
	AbuseNoticeKind,
} from '../constants/notice.constants';

export interface AbuseNotice {
	kind: AbuseNoticeKind;
	caseId: string;
	category: AbuseReportCategory | null;
	audience: AbuseNoticeAudience;
	sandboxId: string;
	sandboxName: string;
	machineId: string | null;
	machineName: string | null;
	signals: AbuseSignalKind[];
}

export class AbuseNoticeEvent {
	constructor(
		readonly organizationId: string,
		readonly noticeId: string,
		readonly notice: AbuseNotice,
		readonly observedAt: Date
	) {}
}
