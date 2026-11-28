/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

let supported: boolean | null = null;

export function supportsWebgl() {
	if (supported === null) {
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
		supported = context !== null;
		context?.getExtension('WEBGL_lose_context')?.loseContext();
	}
	return supported;
}

export function subscribeNothing() {
	return () => undefined;
}
