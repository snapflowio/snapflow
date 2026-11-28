/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { connect } from 'node:net';

export function acceptsTcp(
	host: string,
	port: number,
	timeoutMilliseconds: number
): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({ host, port, timeout: timeoutMilliseconds });
		const finish = (reachable: boolean) => {
			socket.destroy();
			resolve(reachable);
		};
		socket.once('connect', () => finish(true));
		socket.once('timeout', () => finish(false));
		socket.once('error', () => finish(false));
	});
}
