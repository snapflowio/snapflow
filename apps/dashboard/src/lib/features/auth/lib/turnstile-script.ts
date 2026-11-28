/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const TURNSTILE_SCRIPT_URL =
	'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let turnstileScript: Promise<void> | null = null;

export function loadTurnstile(): Promise<void> {
	turnstileScript ??= new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = TURNSTILE_SCRIPT_URL;
		script.async = true;
		script.addEventListener('load', () => resolve(), { once: true });
		script.addEventListener(
			'error',
			() => {
				script.remove();
				turnstileScript = null;
				reject(new Error('The Cloudflare Turnstile script failed to load'));
			},
			{ once: true }
		);
		document.head.append(script);
	});
	return turnstileScript;
}
