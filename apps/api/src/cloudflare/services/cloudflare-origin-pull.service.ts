/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { X509Certificate } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type Cloudflare from 'cloudflare';
import { z } from 'zod';
import { requiredVaultRequest } from '../../common/utils/vault-client.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import {
	ORIGIN_PULL_CERTIFICATE_AUTHORITY,
	ORIGIN_PULL_CERTIFICATE_STATUS,
	ORIGIN_PULL_RECONCILER,
} from '../constants/origin-pull.constants';
import { cloudflareRequest } from '../utils/cloudflare-request.util';
import {
	isUsableOriginPullCertificate,
	type OriginPullCertificate,
	originPullCertificateExpiresAt,
} from '../utils/origin-pull-certificate.util';
import { CloudflareZoneService } from './cloudflare-zone.service';

const SSL_PERMISSION = 'SSL and Certificates:Edit';

const issuedCertificateSchema = z.object({
	data: z.object({
		certificate: z.string().min(1),
		private_key: z.string().min(1),
	}),
});

type IssuedCertificate = Readonly<{ certificate: string; privateKey: string }>;

@Injectable()
export class CloudflareOriginPullService {
	private readonly logger = new Logger(CloudflareOriginPullService.name);

	constructor(
		private readonly zone: CloudflareZoneService,
		private readonly locks: RedisLockProvider,
		private readonly config: TypedConfigService
	) {}

	async reconcile(): Promise<void> {
		if (!this.zone.isConfigured()) return;
		await this.locks.runExclusive(
			ORIGIN_PULL_RECONCILER.lockKey,
			ORIGIN_PULL_RECONCILER.lockTtlSeconds,
			() => this.reconcileZone()
		);
	}

	private async reconcileZone(): Promise<void> {
		const { client, zoneId } = await this.zone.connection();
		const certificates = await this.list(client, zoneId);
		const renewBy = new Date(
			Date.now() + ORIGIN_PULL_RECONCILER.renewBeforeMilliseconds
		);
		const current =
			newest(
				certificates.filter((certificate) =>
					isUsableOriginPullCertificate(certificate, renewBy)
				)
			) ?? (await this.upload(client, zoneId));
		await this.enable(client, zoneId);
		if (current.status !== ORIGIN_PULL_CERTIFICATE_STATUS.ACTIVE) return;
		await this.removeSuperseded(client, zoneId, certificates, current);
	}

	private async list(
		client: Cloudflare,
		zoneId: string
	): Promise<OriginPullCertificate[]> {
		return cloudflareRequest(
			SSL_PERMISSION,
			'list the zone authenticated origin pull certificates',
			async () => {
				const certificates: OriginPullCertificate[] = [];
				for await (const certificate of client.originTLSClientAuth.zoneCertificates.list(
					{ zone_id: zoneId }
				)) {
					certificates.push(certificate);
				}
				return certificates;
			}
		);
	}

	private async upload(
		client: Cloudflare,
		zoneId: string
	): Promise<OriginPullCertificate> {
		const issued = await this.issue();
		const uploaded = await cloudflareRequest(
			SSL_PERMISSION,
			'upload a zone authenticated origin pull certificate',
			() =>
				client.originTLSClientAuth.zoneCertificates.create({
					zone_id: zoneId,
					certificate: issued.certificate,
					private_key: issued.privateKey,
				})
		);
		this.logger.log(
			`Uploaded Cloudflare origin pull certificate ${uploaded.id ?? 'unknown'} expiring ${uploaded.expires_on ?? 'unknown'}`
		);
		return uploaded;
	}

	private async issue(): Promise<IssuedCertificate> {
		const path = [
			encodeURIComponent(ORIGIN_PULL_CERTIFICATE_AUTHORITY.MOUNT),
			'issue',
			encodeURIComponent(ORIGIN_PULL_CERTIFICATE_AUTHORITY.ROLE),
		].join('/');
		const response = await requiredVaultRequest(
			{ address: this.config.get('vault').proxyUrl },
			path,
			issuedCertificateSchema,
			{
				body: {
					common_name: ORIGIN_PULL_CERTIFICATE_AUTHORITY.COMMON_NAME,
					ttl: ORIGIN_PULL_CERTIFICATE_AUTHORITY.TTL,
					format: ORIGIN_PULL_CERTIFICATE_AUTHORITY.FORMAT,
					private_key_format:
						ORIGIN_PULL_CERTIFICATE_AUTHORITY.PRIVATE_KEY_FORMAT,
				},
			}
		);
		const certificate = response.data.certificate.trim();
		const parsed = new X509Certificate(certificate);
		if (
			Date.parse(parsed.validTo) <=
			Date.now() + ORIGIN_PULL_RECONCILER.renewBeforeMilliseconds
		) {
			throw new Error(
				`OpenBao issued an origin pull certificate that expires ${parsed.validTo}, inside the renewal window`
			);
		}
		return { certificate, privateKey: response.data.private_key.trim() };
	}

	private async enable(client: Cloudflare, zoneId: string): Promise<void> {
		const settings = await cloudflareRequest(
			SSL_PERMISSION,
			'read the zone authenticated origin pull setting',
			() => client.originTLSClientAuth.settings.get({ zone_id: zoneId })
		);
		if (settings.enabled) return;
		await cloudflareRequest(
			SSL_PERMISSION,
			'enable zone authenticated origin pulls',
			() =>
				client.originTLSClientAuth.settings.update({
					zone_id: zoneId,
					enabled: true,
				})
		);
		this.logger.log('Enabled zone authenticated origin pulls');
	}

	private async removeSuperseded(
		client: Cloudflare,
		zoneId: string,
		certificates: readonly OriginPullCertificate[],
		current: OriginPullCertificate
	): Promise<void> {
		for (const certificate of certificates) {
			if (
				!certificate.id ||
				certificate.id === current.id ||
				certificate.status ===
					ORIGIN_PULL_CERTIFICATE_STATUS.PENDING_DELETION ||
				certificate.status === ORIGIN_PULL_CERTIFICATE_STATUS.DELETED
			) {
				continue;
			}
			const certificateId = certificate.id;
			await cloudflareRequest(
				SSL_PERMISSION,
				'delete a superseded zone authenticated origin pull certificate',
				() =>
					client.originTLSClientAuth.zoneCertificates.delete(certificateId, {
						zone_id: zoneId,
					})
			);
			this.logger.log(
				`Deleted superseded Cloudflare origin pull certificate ${certificateId}`
			);
		}
	}
}

function newest(
	certificates: readonly OriginPullCertificate[]
): OriginPullCertificate | undefined {
	return [...certificates].sort(
		(left, right) =>
			originPullCertificateExpiresAt(right) -
			originPullCertificateExpiresAt(left)
	)[0];
}
