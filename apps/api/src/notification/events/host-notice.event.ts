/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MachineCheck } from '../../machine/constants/machine-check.constants';
import type { HostNoticeKind } from '../constants/notice.constants';

export type HostNotice =
	| {
			kind: typeof HostNoticeKind.PAYOUT_SENT;
			payoutAddress: string;
			transactionHash: string | null;
	  }
	| {
			kind: typeof HostNoticeKind.PAYOUT_WALLET_MISSING;
	  }
	| {
			kind: typeof HostNoticeKind.PAYOUT_WALLET_CHANGED;
			payoutAddress: string;
	  }
	| {
			kind: typeof HostNoticeKind.MACHINE_OFFLINE;
			machineId: string;
			machineName: string;
	  }
	| {
			kind: typeof HostNoticeKind.MACHINE_FAILED;
			machineId: string;
			machineName: string;
			reason: string | null;
	  }
	| {
			kind: typeof HostNoticeKind.MACHINE_IDLE;
			machineId: string;
			machineName: string;
			utilizationBasisPoints: number;
			rateUnit: string;
			currentRateMicroUsd: string;
			marketMedianRateMicroUsd: string | null;
	  }
	| {
			kind: typeof HostNoticeKind.MACHINE_CHECK_FAILED;
			machineId: string;
			machineName: string;
			check: MachineCheck;
			failures: string[];
	  };

export class HostNoticeEvent {
	constructor(
		readonly organizationId: string,
		readonly noticeId: string,
		readonly notice: HostNotice,
		readonly observedAt: Date
	) {}
}
