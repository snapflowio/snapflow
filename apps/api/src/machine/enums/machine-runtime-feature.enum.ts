/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum MachineRuntimeFeature {
	CHECKPOINT = 'checkpoint',
	FORK = 'fork',
	GUEST_SERVICE = 'guest_service',
	NETWORK_POLICY = 'network_policy',
	PAUSE = 'pause',
	RUNTIME_PORT = 'runtime_port',
	VOLUME = 'volume',
}
