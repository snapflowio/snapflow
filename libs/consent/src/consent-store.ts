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

import {
	CONSENT_COOKIE,
	CONSENT_MAX_AGE_MILLISECONDS,
	CONSENT_VERSION,
} from './consent.constants.js';

const COOKIE_PATH = '/';
const COOKIE_SAME_SITE = 'lax';

export const CONSENT_CHANGE_EVENT = 'snapflow:consent-change';
export const CONSENT_OPEN_EVENT = 'snapflow:consent-open';

export interface ConsentChoices {
	readonly analytics: boolean;
}

export interface ConsentState extends ConsentChoices {
	readonly version: number;
	readonly decidedAt: string;
}

function isConsentState(value: unknown): value is ConsentState {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const candidate: Partial<ConsentState> = value;
	return (
		candidate.version === CONSENT_VERSION &&
		typeof candidate.analytics === 'boolean' &&
		typeof candidate.decidedAt === 'string'
	);
}

function parseConsent(raw: string): ConsentState | undefined {
	try {
		const parsed: unknown = JSON.parse(decodeURIComponent(raw));
		return isConsentState(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

export async function readConsent(): Promise<ConsentState | undefined> {
	const cookie = await window.cookieStore.get(CONSENT_COOKIE);
	return cookie?.value ? parseConsent(cookie.value) : undefined;
}

export async function writeConsent(
	choices: ConsentChoices
): Promise<ConsentState> {
	const state: ConsentState = {
		version: CONSENT_VERSION,
		analytics: choices.analytics,
		decidedAt: new Date().toISOString(),
	};
	await window.cookieStore.set({
		name: CONSENT_COOKIE,
		value: encodeURIComponent(JSON.stringify(state)),
		path: COOKIE_PATH,
		sameSite: COOKIE_SAME_SITE,
		expires: Date.now() + CONSENT_MAX_AGE_MILLISECONDS,
	});
	window.dispatchEvent(
		new CustomEvent<ConsentState>(CONSENT_CHANGE_EVENT, { detail: state })
	);
	return state;
}

export function onConsentChange(
	listener: (state: ConsentState) => void
): () => void {
	const handler = (event: Event) => {
		if (event instanceof CustomEvent && isConsentState(event.detail)) {
			listener(event.detail);
		}
	};
	window.addEventListener(CONSENT_CHANGE_EVENT, handler);
	return () => window.removeEventListener(CONSENT_CHANGE_EVENT, handler);
}

export function openConsentSettings(): void {
	window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
