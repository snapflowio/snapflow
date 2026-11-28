/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const LOAD_GATE_ATTRIBUTE = 'data-load-gate';
export const LOAD_GATE_READY = 'ready';
export const LOAD_GATE_PENDING = 'pending';

export function loadGateState(ready: boolean) {
	return ready ? LOAD_GATE_READY : LOAD_GATE_PENDING;
}
