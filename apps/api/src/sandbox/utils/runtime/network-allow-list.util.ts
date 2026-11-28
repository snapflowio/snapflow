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
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
import {
	validateDomainAllowList,
	validateNetworkAllowList,
} from './network-validation.util';

export function requireValidNetworkAllowList(networkAllowList: string): string {
	try {
		validateNetworkAllowList(networkAllowList);
	} catch (error) {
		throw new BadRequestException(
			apiError(
				SandboxErrorCode.NETWORK_POLICY_INVALID,
				error instanceof Error
					? `The network allow list is invalid: ${error.message}`
					: 'The network allow list is invalid. Use comma-separated CIDR ranges.'
			),
			{ cause: error }
		);
	}
	return networkAllowList;
}

export function requireValidDomainAllowList(domainAllowList: string): string {
	try {
		validateDomainAllowList(domainAllowList);
	} catch (error) {
		throw new BadRequestException(
			apiError(
				SandboxErrorCode.NETWORK_POLICY_INVALID,
				error instanceof Error
					? `The domain allow list is invalid: ${error.message}`
					: 'The domain allow list is invalid. Use comma-separated domain names.'
			),
			{ cause: error }
		);
	}
	return domainAllowList;
}
