/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { text } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const edgeTlsEnvironment = defineEnvironment(
	{
		title: 'Edge TLS',
		description:
			'The TLS identity and trust anchors the API hands to enrolled edges over their session',
	},
	{
		SNAPFLOW_EDGE_TLS_CERTIFICATE_FILE: environmentVariable(text(), {
			description:
				'PEM chain of the certificate edges serve for the platform domain and their tunnel host.',
		}),
		SNAPFLOW_EDGE_TLS_PRIVATE_KEY_FILE: environmentVariable(text(), {
			description: 'PEM private key of that certificate.',
		}),
		SNAPFLOW_EDGE_TUNNEL_CLIENT_CA_FILE: environmentVariable(text(), {
			description:
				'PEM root that signs Machine and origin tunnel client certificates.',
		}),
		SNAPFLOW_EDGE_ORIGIN_CLIENT_CA_FILE: environmentVariable(text(), {
			description:
				'PEM root of the client certificate the CDN presents to edges (Cloudflare Authenticated Origin Pulls).',
		}),
	}
);
