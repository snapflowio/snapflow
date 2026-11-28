/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { apiError } from '../../../common/utils/error/api-error.util';
import type { SandboxNetworkFields } from '../../../machine/utils/proto/sandbox-runtime-spec.util';
import { MINIMUM_EGRESS_BANDWIDTH_BPS } from '../../constants/network.constants';
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
import {
	requireValidDomainAllowList,
	requireValidNetworkAllowList,
} from './network-allow-list.util';

export function assertOrganizationEgressBandwidth(
	limitedNetworkEgress: boolean,
	requested: number | null | undefined
): void {
	if (
		limitedNetworkEgress &&
		(requested === null ||
			(requested !== undefined && requested > MINIMUM_EGRESS_BANDWIDTH_BPS))
	) {
		throw new BadRequestException(
			apiError(
				SandboxErrorCode.NETWORK_POLICY_LOCKED,
				`The organization network policy caps sandbox egress at ${MINIMUM_EGRESS_BANDWIDTH_BPS} bits per second. Ask an organization admin to change the policy to raise it.`
			)
		);
	}
}

export function networkSettingsUpdate(
	networkBlockAll: boolean | undefined,
	networkAllowList: string | undefined,
	domainAllowList: string | undefined,
	egressBandwidthBps: number | null | undefined
): Partial<SandboxNetworkFields> {
	const updateData: Partial<SandboxNetworkFields> = {};
	if (egressBandwidthBps !== undefined) {
		updateData.egressBandwidthBps = egressBandwidthBps;
	}
	if (domainAllowList !== undefined) {
		if (domainAllowList.trim() === '') {
			updateData.domainAllowList = null;
		} else {
			updateData.domainAllowList = requireValidDomainAllowList(domainAllowList);
			updateData.networkBlockAll = false;
		}
	}
	if (networkBlockAll !== undefined) {
		updateData.networkBlockAll = networkBlockAll;
		if (networkBlockAll) {
			updateData.networkAllowList = null;
			updateData.domainAllowList = null;
		}
	}
	if (networkAllowList !== undefined) {
		if (networkAllowList.trim() === '') {
			updateData.networkAllowList = null;
		} else {
			updateData.networkAllowList =
				requireValidNetworkAllowList(networkAllowList);
			updateData.networkBlockAll = false;
		}
	} else if (networkBlockAll === false) {
		updateData.networkAllowList = null;
	}
	return updateData;
}
