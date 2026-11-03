/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';

const REGISTRY_URL_PATTERN =
	/^(?:https?:\/\/)?[a-zA-Z0-9.-]+(?::[0-9]+)?(?:\/[a-zA-Z0-9._/-]*)?$/;

export const registryUrlSchema = z
	.string()
	.trim()
	.min(1, 'Registry URL is required')
	.regex(
		REGISTRY_URL_PATTERN,
		'Invalid URL format (e.g., docker.io or https://gcr.io)'
	);
