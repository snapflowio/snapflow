/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const HTTP_METHOD = {
	GET: 'GET',
	HEAD: 'HEAD',
	OPTIONS: 'OPTIONS',
	DELETE: 'DELETE',
} as const;

export const SAFE_HTTP_METHODS: ReadonlySet<string> = new Set([
	HTTP_METHOD.GET,
	HTTP_METHOD.HEAD,
	HTTP_METHOD.OPTIONS,
]);
