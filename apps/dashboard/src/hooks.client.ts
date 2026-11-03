/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ClientInit, HandleClientError } from '@sveltejs/kit/hooks';
import { notifySessionChanged } from '#lib/api/auth/session.ts';
import { configureApiClient } from '#lib/api/client/api-client.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

export const init: ClientInit = () => {
	configureApiClient(notifySessionChanged);
};

export const handleError: HandleClientError = ({ error, kind }) => {
	if (kind !== 'unknown') return;
	const normalized = SnapflowError.fromUnknown(error);
	const stack = error instanceof Error ? (error.stack ?? '') : '';
	return {
		message: normalized.message,
		details: `${normalized.name}: ${normalized.message}\n\n${stack}`,
	};
};
