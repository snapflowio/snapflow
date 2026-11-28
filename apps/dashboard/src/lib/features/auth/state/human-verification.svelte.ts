/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PublicConfig } from '@snapflow/api-client';
import type { Attachment } from 'svelte/attachments';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import { loadTurnstile } from '#lib/features/auth/lib/turnstile-script.ts';

const VERIFICATION_FAILED_MESSAGE =
	"We couldn't confirm you're human. Refresh the page and try again.";
const VERIFICATION_UNAVAILABLE_MESSAGE =
	'Bot protection could not load. Allow challenges.cloudflare.com and refresh the page.';

export class HumanVerification {
	readonly #config: PublicConfig['humanVerification'];
	#widgetId: string | null = null;
	#token: string | null = null;
	#waiter: PromiseWithResolvers<string> | null = null;
	#failure: SnapflowError | null = null;
	interactive = $state(false);

	constructor(config: PublicConfig['humanVerification']) {
		this.#config = config;
	}

	readonly widget: Attachment<HTMLElement> = (element) => {
		let detached = false;
		loadTurnstile().then(
			() => {
				if (detached) return;
				this.#widgetId =
					turnstile.render(element, {
						sitekey: this.#config.siteKey,
						action: this.#config.action,
						appearance: 'interaction-only',
						size: 'flexible',
						callback: (token) => this.#accept(token),
						'expired-callback': () => {
							this.#token = null;
						},
						'before-interactive-callback': () => {
							this.interactive = true;
						},
						'after-interactive-callback': () => {
							this.interactive = false;
						},
						'error-callback': () => {
							this.#fail(new SnapflowError(VERIFICATION_FAILED_MESSAGE));
						},
					}) ?? null;
			},
			() => this.#fail(new SnapflowError(VERIFICATION_UNAVAILABLE_MESSAGE))
		);
		return () => {
			detached = true;
			if (this.#widgetId) turnstile.remove(this.#widgetId);
			this.#widgetId = null;
			this.#token = null;
			this.interactive = false;
		};
	};

	token(): Promise<string> {
		if (this.#token) {
			const token = this.#token;
			this.#token = null;
			if (this.#widgetId) turnstile.reset(this.#widgetId);
			return Promise.resolve(token);
		}
		if (this.#failure) {
			const failure = this.#failure;
			this.#failure = null;
			return Promise.reject(failure);
		}
		this.#waiter ??= Promise.withResolvers<string>();
		return this.#waiter.promise;
	}

	#accept(token: string): void {
		this.#failure = null;
		const waiter = this.#waiter;
		this.#waiter = null;
		if (!waiter) {
			this.#token = token;
			return;
		}
		if (this.#widgetId) turnstile.reset(this.#widgetId);
		waiter.resolve(token);
	}

	#fail(failure: SnapflowError): void {
		const waiter = this.#waiter;
		this.#waiter = null;
		if (waiter) {
			waiter.reject(failure);
			return;
		}
		this.#failure = failure;
	}
}
