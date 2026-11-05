/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { X509Certificate } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import {
	requiredVaultRequest,
	VaultRequestError,
} from '../../../common/utils/vault-client.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { TUNNEL_CERTIFICATE_AUTHORITY } from '../../constants/machine-tunnel.constants';
import type {
	TunnelCertificateSigner,
	TunnelCertificateSigningRequest,
	TunnelCertificateSigningResult,
} from '../../types/tunnel-certificate-signer.types';

const CERTIFICATE_CLOCK_SKEW_MILLISECONDS = 30_000;
const VAULT_CERTIFICATE_FORMAT = 'pem';

const vaultSigningResponseSchema = z.object({
	data: z
		.object({
			certificate: z.string().optional(),
			ca_chain: z.array(z.string()).optional(),
		})
		.optional(),
});

type VaultSigningResponse = z.infer<typeof vaultSigningResponseSchema>;

@Injectable()
export class VaultTunnelCertificateSigner implements TunnelCertificateSigner {
	constructor(private readonly config: TypedConfigService) {}

	async sign(
		request: TunnelCertificateSigningRequest
	): Promise<TunnelCertificateSigningResult> {
		const response = await this.requestSignature({
			csr: request.csr,
			uri_sans: request.spiffeId,
			exclude_cn_from_sans: true,
			format: VAULT_CERTIFICATE_FORMAT,
			ttl: `${request.ttlSeconds}s`,
		});

		const certificate = response.data?.certificate?.trim();
		if (!certificate) {
			throw new ServiceUnavailableException(
				'Tunnel certificate authority returned no certificate'
			);
		}
		const parsed = this.validateCertificate(certificate, request);
		const chain = [
			certificate,
			...(response.data?.ca_chain ?? []).map((entry) => entry.trim()),
		].filter(
			(entry, index, values) => entry && values.indexOf(entry) === index
		);
		return {
			certificateChain: `${chain.join('\n')}\n`,
			expiresAt: new Date(parsed.validTo),
		};
	}

	private validateCertificate(
		certificate: string,
		request: TunnelCertificateSigningRequest
	): X509Certificate {
		let parsed: X509Certificate;
		try {
			parsed = new X509Certificate(certificate);
		} catch {
			throw new ServiceUnavailableException(
				'Tunnel certificate authority returned malformed certificate data'
			);
		}
		if (parsed.publicKey.asymmetricKeyType !== 'ed25519') {
			throw new ServiceUnavailableException(
				'Tunnel certificate authority returned a non-Ed25519 certificate'
			);
		}
		if (parsed.subjectAltName !== `URI:${request.spiffeId}`) {
			throw new ServiceUnavailableException(
				'Tunnel certificate authority returned the wrong workload identity'
			);
		}
		const now = Date.now();
		const notBefore = Date.parse(parsed.validFrom);
		const notAfter = Date.parse(parsed.validTo);
		const maximumLifetime = request.ttlSeconds * MILLISECONDS_PER_SECOND;
		if (
			!Number.isFinite(notBefore) ||
			!Number.isFinite(notAfter) ||
			notBefore > now + CERTIFICATE_CLOCK_SKEW_MILLISECONDS ||
			notAfter <= now ||
			notAfter - notBefore >
				maximumLifetime + CERTIFICATE_CLOCK_SKEW_MILLISECONDS
		) {
			throw new ServiceUnavailableException(
				'Tunnel certificate authority returned an invalid validity window'
			);
		}
		return parsed;
	}

	private async requestSignature(
		body: Readonly<Record<string, unknown>>
	): Promise<VaultSigningResponse> {
		const path = [
			encodeURIComponent(TUNNEL_CERTIFICATE_AUTHORITY.MOUNT),
			'sign',
			encodeURIComponent(TUNNEL_CERTIFICATE_AUTHORITY.ROLE),
		].join('/');
		try {
			return await requiredVaultRequest(
				{ address: this.config.get('vault').proxyUrl },
				path,
				vaultSigningResponseSchema,
				{ body }
			);
		} catch (error: unknown) {
			if (!(error instanceof VaultRequestError)) throw error;
			throw new ServiceUnavailableException(
				`Tunnel certificate authority request failed (${error.status})`,
				{ cause: error }
			);
		}
	}
}
