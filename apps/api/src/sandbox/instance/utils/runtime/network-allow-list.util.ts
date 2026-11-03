/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import {
	validateDomainAllowList,
	validateNetworkAllowList,
} from './network-validation.util';

export function requireValidNetworkAllowList(networkAllowList: string): string {
	try {
		validateNetworkAllowList(networkAllowList);
	} catch (error) {
		throw new BadRequestException(
			error instanceof Error ? error.message : 'Invalid network allow list'
		);
	}
	return networkAllowList;
}

export function requireValidDomainAllowList(domainAllowList: string): string {
	try {
		validateDomainAllowList(domainAllowList);
	} catch (error) {
		throw new BadRequestException(
			error instanceof Error ? error.message : 'Invalid domain allow list'
		);
	}
	return domainAllowList;
}
