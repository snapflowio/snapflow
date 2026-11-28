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

import { type AnalyticsConfig, syncAnalytics } from './analytics.js';
import { CONSENT_BANNER_TAG, ConsentBanner } from './consent-banner.js';
import {
	CONSENT_OPEN_EVENT,
	type ConsentState,
	onConsentChange,
	readConsent,
} from './consent-store.js';

export type { AnalyticsConfig } from './analytics.js';
export {
	type ConsentState,
	openConsentSettings,
	readConsent,
} from './consent-store.js';

export interface ConsentOptions {
	readonly analytics?: AnalyticsConfig | undefined;
}

export const CONSENT_SETTINGS_ATTRIBUTE = 'data-consent-settings';

let mounted = false;

function showBanner(): ConsentBanner {
	const existing = document.querySelector(CONSENT_BANNER_TAG);
	return existing instanceof ConsentBanner
		? existing
		: document.body.appendChild(new ConsentBanner());
}

function openBanner(): void {
	showBanner().focusChoice();
}

function applyConsent(
	analytics: AnalyticsConfig,
	state: ConsentState | undefined
): void {
	syncAnalytics(analytics, state).catch((error: unknown) => {
		window.reportError(error);
	});
}

async function restoreConsent(analytics: AnalyticsConfig): Promise<void> {
	const consent = await readConsent();
	applyConsent(analytics, consent);
	if (!consent) {
		showBanner();
	}
}

export function mountConsent({ analytics }: ConsentOptions): void {
	if (mounted || !analytics) {
		return;
	}
	mounted = true;
	if (!customElements.get(CONSENT_BANNER_TAG)) {
		customElements.define(CONSENT_BANNER_TAG, ConsentBanner);
	}
	onConsentChange((state) => applyConsent(analytics, state));
	window.addEventListener(CONSENT_OPEN_EVENT, openBanner);
	document.addEventListener('click', (event) => {
		if (
			event.target instanceof Element &&
			event.target.closest(`[${CONSENT_SETTINGS_ATTRIBUTE}]`)
		) {
			openBanner();
		}
	});
	restoreConsent(analytics).catch((error: unknown) => {
		window.reportError(error);
	});
}
