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

import { CONSENT_BANNER_STYLES } from './consent-banner.styles.js';
import {
	type ConsentChoices,
	readConsent,
	writeConsent,
} from './consent-store.js';
import { CookieOutcome, DitherCookie } from './dither-cookie.js';

export const CONSENT_BANNER_TAG = 'snapflow-consent-banner';

const PRIVACY_HREF = '/privacy#tracking-technologies';
const CLOSING_ATTRIBUTE = 'closing';
const ACTION_ATTRIBUTE = 'data-action';

const Action = {
	ACCEPT: 'accept',
	REJECT: 'reject',
} as const;

type Action = (typeof Action)[keyof typeof Action];

const CURRENT_CHOICE = {
	ALLOWED: 'You currently allow analytics cookies.',
	DECLINED: 'You currently decline analytics cookies.',
} as const;

const TEMPLATE = `
<section class="banner" role="dialog" aria-labelledby="consent-title" aria-describedby="consent-description consent-current">
	<canvas class="cookie" aria-hidden="true"></canvas>
	<div class="content">
		<h2 id="consent-title">Cookies</h2>
		<p id="consent-description">
			We use essential cookies to keep you signed in. With your permission, PostHog
			analytics cookies help us improve Snapflow.
			<a href="${PRIVACY_HREF}">Privacy policy</a>
		</p>
		<p id="consent-current" class="current" hidden></p>
		<div class="actions">
			<button type="button" class="choice" data-action="${Action.REJECT}">Decline</button>
			<button type="button" class="choice" data-action="${Action.ACCEPT}">Accept</button>
		</div>
	</div>
</section>
`;

function isAction(value: string | undefined): value is Action {
	return Object.values(Action).some((action) => action === value);
}

export class ConsentBanner extends HTMLElement {
	private readonly root: ShadowRoot;
	private cookie: DitherCookie | undefined;

	constructor() {
		super();
		this.root = this.attachShadow({ mode: 'open' });
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(CONSENT_BANNER_STYLES);
		this.root.adoptedStyleSheets = [sheet];
		this.root.innerHTML = TEMPLATE;
		this.root.addEventListener('click', (event) => this.handleClick(event));
	}

	connectedCallback(): void {
		readConsent().then(
			(state) => {
				if (!state) {
					return;
				}
				const current = this.root.querySelector<HTMLElement>('.current');
				if (current) {
					current.textContent = state.analytics
						? CURRENT_CHOICE.ALLOWED
						: CURRENT_CHOICE.DECLINED;
					current.hidden = false;
				}
			},
			(error: unknown) => window.reportError(error)
		);
		const canvas = this.root.querySelector('canvas');
		if (canvas) {
			this.cookie = new DitherCookie(canvas);
			this.cookie.start();
		}
	}

	focusChoice(): void {
		this.root
			.querySelector<HTMLButtonElement>('.choice')
			?.focus({ preventScroll: true });
	}

	disconnectedCallback(): void {
		this.cookie?.stop();
	}

	private handleClick(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLButtonElement)) {
			return;
		}
		const action = target.getAttribute(ACTION_ATTRIBUTE) ?? undefined;
		if (!isAction(action)) {
			return;
		}
		const accepted = action === Action.ACCEPT;
		this.decide(
			{ analytics: accepted },
			accepted ? CookieOutcome.ACCEPT : CookieOutcome.REJECT
		);
	}

	private decide(choices: ConsentChoices, outcome: CookieOutcome): void {
		this.setAttribute(CLOSING_ATTRIBUTE, '');
		Promise.all([writeConsent(choices), this.cookie?.play(outcome)]).then(
			() => this.remove(),
			(error: unknown) => {
				this.removeAttribute(CLOSING_ATTRIBUTE);
				window.reportError(error);
			}
		);
	}
}
