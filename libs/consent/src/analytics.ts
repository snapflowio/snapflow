/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PostHog } from 'posthog-js/dist/module.no-external.js';
import type { ConsentState } from './consent-store.js';

const POSTHOG_STORAGE_PREFIX = 'ph_';
const AUTOCAPTURE_IGNORED_ATTRIBUTES = [
	'aria-label',
	'title',
	'alt',
	'placeholder',
	'value',
] as const;

export interface AnalyticsConfig {
	readonly projectKey: string;
	readonly host: string;
}

let client: PostHog | undefined;

async function startAnalytics(config: AnalyticsConfig): Promise<PostHog> {
	const { posthog } = await import('posthog-js/dist/module.no-external.js');
	posthog.init(config.projectKey, {
		api_host: config.host,
		person_profiles: 'identified_only',
		persistence: 'localStorage+cookie',
		autocapture: {
			element_attribute_ignorelist: [...AUTOCAPTURE_IGNORED_ATTRIBUTES],
		},
		mask_all_text: true,
		mask_personal_data_properties: true,
		capture_pageview: 'history_change',
		capture_pageleave: true,
		disable_session_recording: true,
		disable_surveys: true,
		disable_external_dependency_loading: true,
		cross_subdomain_cookie: false,
	});
	return posthog;
}

async function clearAnalyticsStorage(): Promise<void> {
	const cookies = await window.cookieStore.getAll();
	await Promise.all(
		cookies.flatMap(({ name }) =>
			name?.startsWith(POSTHOG_STORAGE_PREFIX)
				? [window.cookieStore.delete(name)]
				: []
		)
	);
	for (const key of Object.keys(window.localStorage)) {
		if (key.startsWith(POSTHOG_STORAGE_PREFIX)) {
			window.localStorage.removeItem(key);
		}
	}
}

export async function syncAnalytics(
	config: AnalyticsConfig,
	consent: ConsentState | undefined
): Promise<void> {
	if (consent?.analytics) {
		if (client) {
			client.opt_in_capturing();
			return;
		}
		client = await startAnalytics(config);
		return;
	}
	if (client) {
		client.opt_out_capturing();
		client.reset();
	}
	await clearAnalyticsStorage();
}
