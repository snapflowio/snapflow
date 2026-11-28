/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, X509Certificate } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
	Injectable,
	Logger,
	ServiceUnavailableException,
} from '@nestjs/common';
import { errorMessage } from '../../../common/utils/error/error.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import type { EdgeTlsBundleDto } from '../../dto/edge-tls-bundle.dto';

const PEM_ENCODING = 'utf8';
const DIGEST_ALGORITHM = 'sha256';
const DIGEST_ENCODING = 'hex';
const DIGEST_FIELD_SEPARATOR = '\n\0\n';
const EDGE_TLS_UNAVAILABLE = 'Edge TLS material is unavailable';

function isCertificate(pem: string): boolean {
	try {
		return new X509Certificate(pem).raw.length > 0;
	} catch {
		return false;
	}
}

@Injectable()
export class EdgeTlsBundleService {
	private readonly logger = new Logger(EdgeTlsBundleService.name);

	constructor(private readonly config: TypedConfigService) {}

	async read(): Promise<EdgeTlsBundleDto> {
		const files = this.config.get('edgeTls');
		try {
			const [certificateChain, privateKey, tunnelClientCa, originClientCa] =
				await Promise.all(
					[
						files.certificateFile,
						files.privateKeyFile,
						files.tunnelClientCaFile,
						files.originClientCaFile,
					].map((path) => readFile(path, PEM_ENCODING))
				);
			if (
				![certificateChain, tunnelClientCa, originClientCa].every(isCertificate)
			) {
				throw new Error('a configured edge TLS file is not a PEM certificate');
			}
			const digest = createHash(DIGEST_ALGORITHM)
				.update(
					[certificateChain, privateKey, tunnelClientCa, originClientCa].join(
						DIGEST_FIELD_SEPARATOR
					)
				)
				.digest(DIGEST_ENCODING);
			return {
				certificateChain,
				privateKey,
				tunnelClientCa,
				originClientCa,
				digest,
			};
		} catch (error) {
			this.logger.error(
				`Could not read the edge TLS bundle: ${errorMessage(error)}`
			);
			throw new ServiceUnavailableException(EDGE_TLS_UNAVAILABLE);
		}
	}
}
