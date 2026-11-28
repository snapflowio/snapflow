/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
import { BadRequestException } from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { registrableDomain } from '../../common/utils/registrable-domain.util';
import { NETWORKING_LIMITS } from '../../networking/constants/networking.constants';
import { CustomDomainErrorCode } from '../enums/custom-domain-error-code.enum';

const DNS_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeCustomDomain(
	input: string,
	reservedDomains: readonly string[]
): string {
	const trimmed = input.trim().replace(/\.$/, '');
	if (!trimmed || trimmed.includes('*') || trimmed.includes('://')) {
		throw new BadRequestException(
			apiError(
				CustomDomainErrorCode.HOSTNAME_INVALID,
				'The custom domain must be an exact hostname such as app.example.com, without wildcards or a scheme. Correct it and try again.'
			)
		);
	}
	const hostname = domainToASCII(trimmed).toLowerCase();
	const site = registrableDomain(hostname);
	if (
		!hostname ||
		hostname.length > NETWORKING_LIMITS.maximumHostnameLength ||
		isIP(hostname) !== 0 ||
		!hostname.includes('.') ||
		hostname.split('.').some((label) => !DNS_LABEL_PATTERN.test(label)) ||
		site === null
	) {
		throw new BadRequestException(
			apiError(
				CustomDomainErrorCode.HOSTNAME_INVALID,
				'The custom domain must be a valid public DNS hostname such as app.example.com. Correct it and try again.'
			)
		);
	}
	if (hostname === site) {
		throw new BadRequestException(
			apiError(
				CustomDomainErrorCode.APEX_NOT_SUPPORTED,
				'Root domains such as example.com are not supported. Use a subdomain such as app.example.com.'
			)
		);
	}
	if (
		reservedDomains.some(
			(domain) => hostname === domain || hostname.endsWith(`.${domain}`)
		)
	) {
		throw new BadRequestException(
			apiError(
				CustomDomainErrorCode.HOSTNAME_RESERVED,
				'This hostname belongs to Snapflow and cannot be used as a custom domain. Use a hostname on a domain you own.'
			)
		);
	}
	return hostname;
}
