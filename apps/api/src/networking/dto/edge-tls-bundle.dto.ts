/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'EdgeTlsBundle' })
export class EdgeTlsBundleDto {
	@ApiProperty({
		description: 'PEM certificate chain the edge serves, leaf first',
	})
	certificateChain: string;

	@ApiProperty({ description: 'PEM private key of the certificate' })
	privateKey: string;

	@ApiProperty({
		description: 'PEM root that signs Machine and origin tunnel certificates',
	})
	tunnelClientCa: string;

	@ApiProperty({
		description: 'PEM root of the CDN origin-pull client certificate',
	})
	originClientCa: string;

	@ApiProperty({
		description:
			'SHA-256 of the bundle, lowercase hex; unchanged content keeps it',
	})
	digest: string;
}
