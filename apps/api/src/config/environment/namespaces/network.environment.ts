/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { cidrListText, portText } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

const LOOPBACK_PROXY_CIDRS = '127.0.0.0/8,::1/128';

export const networkEnvironment = defineEnvironment(
	{
		title: 'Network & Proxies',
		description: 'The HTTP listener and the proxies in front of it',
	},
	{
		PORT: environmentVariable(portText().prefault('3001'), {
			description: 'TCP port the HTTP API listens on.',
		}),
		SNAPFLOW_TRUSTED_PROXY_CIDRS: environmentVariable(
			cidrListText().prefault(LOOPBACK_PROXY_CIDRS),
			{ description: 'Proxies whose X-Forwarded-For the API trusts.' }
		),
	}
);
