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
import { registrableDomain } from '../../common/utils/registrable-domain.util';
import { NETWORKING_LIMITS } from '../../networking/constants/networking.constants';

const DNS_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeCustomDomain(
	input: string,
	reservedDomains: readonly string[]
): string {
	const trimmed = input.trim().replace(/\.$/, '');
	if (!trimmed || trimmed.includes('*') || trimmed.includes('://')) {
		throw new BadRequestException('Custom domain must be an exact hostname');
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
			'Custom domain must be a valid public DNS hostname'
		);
	}
	if (hostname === site) {
		throw new BadRequestException(
			'Custom domain must be a subdomain; zone-apex domains require Cloudflare apex proxying'
		);
	}
	if (
		reservedDomains.some(
			(domain) => hostname === domain || hostname.endsWith(`.${domain}`)
		)
	) {
		throw new BadRequestException(
			'Custom domain cannot use a Snapflow-managed ingress hostname'
		);
	}
	return hostname;
}
