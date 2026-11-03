/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PublicConfig } from '@snapflow/api-client';
import { getPublicConfigOptions } from '@snapflow/api-client/svelte-query';
import { queryOptions, useQueryClient } from '@tanstack/svelte-query';

const PRIVACY_PATH = '/privacy';
const TERMS_PATH = '/terms';
const DOCS_PATH = '/docs';

export function publicConfigQueryOptions() {
	return queryOptions({
		...getPublicConfigOptions(),
		gcTime: Number.POSITIVE_INFINITY,
		staleTime: 'static',
	});
}

export function getPublicConfig(): PublicConfig {
	const config = useQueryClient().getQueryData(
		publicConfigQueryOptions().queryKey
	);
	if (!config) {
		throw new Error('The public config was read before the root load ran.');
	}
	return config;
}

export function getWebsiteLinks() {
	const { websiteUrl } = getPublicConfig();
	return {
		docsHref: new URL(DOCS_PATH, websiteUrl).href,
		homeHref: websiteUrl,
		privacyHref: new URL(PRIVACY_PATH, websiteUrl).href,
		termsHref: new URL(TERMS_PATH, websiteUrl).href,
	};
}
