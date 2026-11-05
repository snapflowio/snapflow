/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ConflictException,
	Injectable,
	ServiceUnavailableException,
} from '@nestjs/common';
import { NotFoundError } from 'cloudflare';
import type {
	CustomHostnameCreateResponse,
	CustomHostnameEditResponse,
	CustomHostnameGetResponse,
	CustomHostnameListResponse,
} from 'cloudflare/resources/custom-hostnames/custom-hostnames';
import type { RecordResponse } from 'cloudflare/resources/dns/records';
import type { SettingGetResponse } from 'cloudflare/resources/origin-tls-client-auth/settings';
import type { ZoneCertificateListResponse } from 'cloudflare/resources/origin-tls-client-auth/zone-certificates';
import {
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_MINUTE,
} from '../../../common/constants/time.constants';
import type {
	DomainVerificationRecord,
	ManagedCustomHostname,
} from '../../types/networking.types';
import { RefreshingValue } from '../utils/refreshing-value.util';
import { CloudflareZoneService } from './cloudflare-zone.service';

const CLOUDFLARE_PAGE_SIZE = 50;
const MANAGED_DNS_COMMENT = 'snapflow-managed-edge-ingress';
const AUTOMATIC_DNS_TTL = 1;
const PROXY_CIDR_CACHE_MILLISECONDS = MILLISECONDS_PER_HOUR;
const INGRESS_SECURITY_CACHE_MINUTES = 5;
const INGRESS_SECURITY_CACHE_MILLISECONDS =
	INGRESS_SECURITY_CACHE_MINUTES * MILLISECONDS_PER_MINUTE;

type CloudflareCustomHostname =
	| CustomHostnameCreateResponse
	| CustomHostnameEditResponse
	| CustomHostnameGetResponse
	| CustomHostnameListResponse;

@Injectable()
export class CloudflareDomainProvider {
	private readonly proxyCidrs = new RefreshingValue(
		() => this.loadTrustedProxyCidrs(),
		PROXY_CIDR_CACHE_MILLISECONDS
	);
	private ingressSecurityExpiresAt = 0;
	private ingressSecurityRefresh: Promise<void> | null = null;

	constructor(private readonly zone: CloudflareZoneService) {}

	isConfigured(): boolean {
		return this.zone.isConfigured();
	}

	async trustedProxyCidrs(fallback: readonly string[]): Promise<string[]> {
		if (!this.zone.isConfigured()) return [...fallback];
		try {
			return [...(await this.proxyCidrs.get())];
		} catch (error) {
			if (fallback.length > 0) return [...fallback];
			throw error;
		}
	}

	async ensureManagedCname(
		name: string,
		target: string,
		proxied: boolean
	): Promise<void> {
		await this.assertIngressSecurityReady();
		const { client, zoneId } = await this.zone.connection();
		const existing = await this.findCname(name);
		if (
			existing &&
			(existing.type !== 'CNAME' || existing.comment !== MANAGED_DNS_COMMENT)
		) {
			throw new ConflictException(
				`DNS record ${name} exists and is not managed by Snapflow`
			);
		}
		const input = {
			zone_id: zoneId,
			type: 'CNAME' as const,
			name,
			content: target,
			ttl: AUTOMATIC_DNS_TTL,
			proxied,
			comment: MANAGED_DNS_COMMENT,
		};
		if (existing) {
			await client.dns.records.update(existing.id, input);
			return;
		}
		await client.dns.records.create(input);
	}

	async removeManagedCname(name: string): Promise<void> {
		const { client, zoneId } = await this.zone.connection();
		const existing = await this.findCname(name);
		if (!existing) return;
		if (existing.comment !== MANAGED_DNS_COMMENT) {
			throw new ConflictException(
				`DNS record ${name} is no longer managed by Snapflow`
			);
		}
		try {
			await client.dns.records.delete(existing.id, { zone_id: zoneId });
		} catch (error) {
			if (!(error instanceof NotFoundError)) throw error;
		}
	}

	async ensure(
		hostname: string,
		originHostname: string,
		domainId: string,
		exposureId: string
	): Promise<ManagedCustomHostname> {
		await this.assertIngressSecurityReady();
		const { client, zoneId } = await this.zone.connection();
		const metadata = {
			snapflow_domain_id: domainId,
			snapflow_exposure_id: exposureId,
		};
		const existing = await this.find(hostname);
		if (existing && !this.isOwned(existing, metadata)) {
			throw new ConflictException(
				'Cloudflare custom hostname is not owned by this Snapflow domain'
			);
		}
		const created =
			existing ??
			(await client.customHostnames.create({
				zone_id: zoneId,
				hostname,
				custom_metadata: metadata,
				ssl: {
					type: 'dv',
					method: 'txt',
					bundle_method: 'ubiquitous',
					settings: {
						min_tls_version: '1.2',
						tls_1_3: 'on',
						http2: 'on',
					},
				},
			}));
		if (
			normalizeDnsName(created.custom_origin_server ?? '') !==
				normalizeDnsName(originHostname) ||
			normalizeDnsName(created.custom_origin_sni ?? '') !==
				normalizeDnsName(originHostname)
		) {
			const updated = await client.customHostnames.edit(created.id, {
				zone_id: zoneId,
				custom_metadata: metadata,
				custom_origin_server: originHostname,
				custom_origin_sni: originHostname,
			});
			return managedHostname(updated);
		}
		return managedHostname(created);
	}

	async remove(
		providerId: string | null,
		hostname: string,
		domainId: string,
		exposureId: string
	): Promise<void> {
		const { client, zoneId } = await this.zone.connection();
		let existing: CloudflareCustomHostname | null = null;
		if (providerId) {
			try {
				existing = await client.customHostnames.get(providerId, {
					zone_id: zoneId,
				});
			} catch (error) {
				if (!(error instanceof NotFoundError)) throw error;
			}
		}
		existing ??= await this.find(hostname);
		if (!existing) return;
		if (
			!this.isOwned(existing, {
				snapflow_domain_id: domainId,
				snapflow_exposure_id: exposureId,
			})
		) {
			throw new ConflictException(
				'Cloudflare custom hostname is no longer owned by this Snapflow domain'
			);
		}
		try {
			await client.customHostnames.delete(existing.id, { zone_id: zoneId });
		} catch (error) {
			if (!(error instanceof NotFoundError)) throw error;
		}
	}

	private async find(
		hostname: string
	): Promise<CustomHostnameListResponse | null> {
		const { client, zoneId } = await this.zone.connection();
		for await (const candidate of client.customHostnames.list({
			zone_id: zoneId,
			hostname: { exact: hostname },
			per_page: CLOUDFLARE_PAGE_SIZE,
		})) {
			if (normalizeDnsName(candidate.hostname) === normalizeDnsName(hostname)) {
				return candidate;
			}
		}
		return null;
	}

	private async findCname(name: string): Promise<RecordResponse | null> {
		const { client, zoneId } = await this.zone.connection();
		for await (const record of client.dns.records.list({
			zone_id: zoneId,
			type: 'CNAME',
			name: { exact: name },
			per_page: CLOUDFLARE_PAGE_SIZE,
		})) {
			if (normalizeDnsName(record.name) === normalizeDnsName(name))
				return record;
		}
		return null;
	}

	private async loadTrustedProxyCidrs(): Promise<string[]> {
		const { client } = this.zone;
		if (!client) {
			throw new ServiceUnavailableException(
				'Cloudflare ingress is not configured'
			);
		}
		const response = await client.ips.list();
		const values = [
			...(response.ipv4_cidrs ?? []),
			...(response.ipv6_cidrs ?? []),
		]
			.map((value) => value.trim())
			.filter(Boolean);
		const uniqueValues = [...new Set(values)].sort();
		if (uniqueValues.length === 0) {
			throw new Error('Cloudflare returned no trusted proxy networks');
		}
		return uniqueValues;
	}

	private async assertIngressSecurityReady(): Promise<void> {
		if (Date.now() < this.ingressSecurityExpiresAt) return;
		this.ingressSecurityRefresh ??= this.refreshIngressSecurity().finally(
			() => {
				this.ingressSecurityRefresh = null;
			}
		);
		await this.ingressSecurityRefresh;
	}

	private async refreshIngressSecurity(): Promise<void> {
		const { client, zoneId } = await this.zone.connection();
		const settings = await client.originTLSClientAuth.settings.get({
			zone_id: zoneId,
		});
		const certificates: ZoneCertificateListResponse[] = [];
		for await (const certificate of client.originTLSClientAuth.zoneCertificates.list(
			{ zone_id: zoneId }
		)) {
			certificates.push(certificate);
		}
		if (!isAccountSpecificAopReady(settings, certificates, new Date())) {
			throw new ServiceUnavailableException(
				'Cloudflare zone-level authenticated origin pulls require exactly one active account-specific certificate'
			);
		}
		this.ingressSecurityExpiresAt =
			Date.now() + INGRESS_SECURITY_CACHE_MILLISECONDS;
	}

	private isOwned(
		hostname: CloudflareCustomHostname,
		metadata: Record<string, string>
	): boolean {
		return Object.entries(metadata).every(
			([key, value]) => hostname.custom_metadata?.[key] === value
		);
	}
}

function isAccountSpecificAopReady(
	settings: SettingGetResponse,
	certificates: readonly ZoneCertificateListResponse[],
	now: Date
): boolean {
	if (!settings.enabled || !Number.isFinite(now.getTime())) return false;
	const active = certificates.filter((certificate) => {
		const expiresAt = Date.parse(certificate.expires_on ?? '');
		return (
			certificate.status === 'active' &&
			certificate.enabled !== false &&
			Number.isFinite(expiresAt) &&
			expiresAt > now.getTime()
		);
	});
	return active.length === 1;
}

function managedHostname(
	hostname: CloudflareCustomHostname
): ManagedCustomHostname {
	const verificationRecords: DomainVerificationRecord[] = [];
	if (
		hostname.ownership_verification?.name &&
		hostname.ownership_verification.value
	) {
		verificationRecords.push({
			type: 'TXT',
			name: hostname.ownership_verification.name,
			value: hostname.ownership_verification.value,
		});
	}
	for (const record of hostname.ssl?.validation_records ?? []) {
		if (record.cname && record.cname_target) {
			verificationRecords.push({
				type: 'CNAME',
				name: record.cname,
				value: record.cname_target,
			});
		}
		if (record.txt_name && record.txt_value) {
			verificationRecords.push({
				type: 'TXT',
				name: record.txt_name,
				value: record.txt_value,
			});
		}
	}
	return {
		id: hostname.id,
		hostnameStatus: hostname.status ?? null,
		certificateStatus: hostname.ssl?.status ?? null,
		verificationRecords,
		errors: [
			...(hostname.verification_errors ?? []),
			...(hostname.ssl?.validation_errors ?? []).flatMap(({ message }) =>
				message ? [message] : []
			),
		],
	};
}

function normalizeDnsName(value: string): string {
	return value.trim().toLowerCase().replace(/\.$/, '');
}
