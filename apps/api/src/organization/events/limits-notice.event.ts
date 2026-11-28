/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import type { LimitsNoticeKind } from '../constants/organization-quota-tier.constants';

interface QuotaIncreaseDecision {
	requestId: string;
	requesterUserId: string | null;
	sandboxClass: SandboxClass;
	cpu: number;
	memory: number;
	disk: number;
	gpu: number;
}

export type LimitsNotice =
	| {
			kind: typeof LimitsNoticeKind.TIER_UPGRADED;
			previousTier: number;
			tier: number;
	  }
	| ({
			kind: typeof LimitsNoticeKind.INCREASE_APPROVED;
	  } & QuotaIncreaseDecision)
	| ({
			kind: typeof LimitsNoticeKind.INCREASE_DENIED;
			reason: string;
	  } & QuotaIncreaseDecision)
	| {
			kind: typeof LimitsNoticeKind.STORAGE_CAP_REACHED;
			capGib: number;
			storedGib: number;
	  };

export class LimitsNoticeEvent {
	constructor(
		readonly organizationId: string,
		readonly noticeId: string,
		readonly notice: LimitsNotice,
		readonly observedAt: Date
	) {}
}
