/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SandboxNetworkFields } from '../../machine/utils/proto/sandbox-runtime-spec.util';
import {
	requireValidDomainAllowList,
	requireValidNetworkAllowList,
} from './network-allow-list.util';

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
