/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';

export const MIN_TCP_PORT = 1;
export const MAX_TCP_PORT = 65_535;
export const DEFAULT_PREVIEW_PORT = '3000';

export const previewSchema = z.object({
	port: z.string().refine((value) => {
		const port = Number(value);
		return (
			Number.isInteger(port) && port >= MIN_TCP_PORT && port <= MAX_TCP_PORT
		);
	}, `Port must be between ${MIN_TCP_PORT} and ${MAX_TCP_PORT}`),
});
