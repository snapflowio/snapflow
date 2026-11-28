/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	ZoneCertificateCreateResponse,
	ZoneCertificateListResponse,
} from 'cloudflare/resources/origin-tls-client-auth/zone-certificates';
import { ORIGIN_PULL_CERTIFICATE_STATUS } from '../constants/origin-pull.constants';

export type OriginPullCertificate =
	| ZoneCertificateCreateResponse
	| ZoneCertificateListResponse;

const USABLE_STATUSES: ReadonlySet<string> = new Set([
	ORIGIN_PULL_CERTIFICATE_STATUS.ACTIVE,
	ORIGIN_PULL_CERTIFICATE_STATUS.INITIALIZING,
	ORIGIN_PULL_CERTIFICATE_STATUS.PENDING_DEPLOYMENT,
]);

export function originPullCertificateExpiresAt(
	certificate: OriginPullCertificate
): number {
	const expiresAt = Date.parse(certificate.expires_on ?? '');
	return Number.isFinite(expiresAt) ? expiresAt : 0;
}

export function isUsableOriginPullCertificate(
	certificate: OriginPullCertificate,
	validUntil: Date
): boolean {
	return (
		USABLE_STATUSES.has(certificate.status ?? '') &&
		certificate.enabled !== false &&
		originPullCertificateExpiresAt(certificate) > validUntil.getTime()
	);
}

export function isServingOriginPullCertificate(
	certificate: OriginPullCertificate,
	now: Date
): boolean {
	return (
		certificate.status === ORIGIN_PULL_CERTIFICATE_STATUS.ACTIVE &&
		certificate.enabled !== false &&
		originPullCertificateExpiresAt(certificate) > now.getTime()
	);
}
