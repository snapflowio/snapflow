/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { VoucherLimit } from '../../settlement/enums/voucher-limit.enum';
import type {
	FundingNoticeKind,
	RunwayWarning,
} from '../constants/funding.constants';

export type FundingNotice =
	| {
			kind: typeof FundingNoticeKind.RUNWAY_WARNING;
			warning: RunwayWarning;
			runwaySeconds: string;
			burnMicroUsdPerHour: string;
	  }
	| {
			kind: typeof FundingNoticeKind.COMPUTE_STOPPED;
			archivesDeleteAt: string;
	  }
	| {
			kind: typeof FundingNoticeKind.ARCHIVE_DELETION_SCHEDULED;
			archivesDeleteAt: string;
	  }
	| {
			kind: typeof FundingNoticeKind.AUTO_TOP_UP_FAILED;
			amountMicroUsd: string;
			reason: string;
	  }
	| {
			kind:
				| typeof FundingNoticeKind.SIGNER_EXPIRING
				| typeof FundingNoticeKind.SIGNER_EXPIRED;
			expiresAt: string;
	  }
	| {
			kind: typeof FundingNoticeKind.SIGNER_REVOKED;
	  }
	| {
			kind: typeof FundingNoticeKind.SANDBOX_PAUSED_FOR_PAYMENT;
			sandboxId: string;
			sandboxName: string;
			reason: VoucherLimit | null;
	  };

export class FundingNoticeEvent {
	constructor(
		readonly organizationId: string,
		readonly noticeId: string,
		readonly notice: FundingNotice,
		readonly observedAt: Date
	) {}
}
