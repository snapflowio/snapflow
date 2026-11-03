/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { httpUrlText } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const vaultEnvironment = defineEnvironment(
	{
		name: 'vault',
		title: 'Vault',
		description:
			'The Vault Proxy that serves the keyrings and signs tunnel certificates',
	},
	{
		SNAPFLOW_VAULT_PROXY_URL: environmentVariable(httpUrlText(), {
			description:
				'Vault Proxy URL; hosted deployments require a loopback proxy.',
		}),
	}
);
