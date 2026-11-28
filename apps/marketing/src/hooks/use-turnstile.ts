/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ABUSE_FORM_MESSAGE } from '@/constants/abuse';
import { loadTurnstile } from '@/lib/turnstile';

export function useTurnstile(siteKey: string | null, action: string) {
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetRef = useRef<string | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!siteKey || !container) return;
		let detached = false;
		loadTurnstile().then(
			() => {
				if (detached) return;
				widgetRef.current =
					turnstile.render(container, {
						sitekey: siteKey,
						action,
						size: 'flexible',
						callback: (issued) => {
							setFailure(null);
							setToken(issued);
						},
						'expired-callback': () => setToken(null),
						'error-callback': () => {
							setToken(null);
							setFailure(ABUSE_FORM_MESSAGE.VERIFICATION_FAILED);
						},
					}) ?? null;
			},
			() => setFailure(ABUSE_FORM_MESSAGE.VERIFICATION_UNAVAILABLE)
		);
		return () => {
			detached = true;
			if (widgetRef.current) turnstile.remove(widgetRef.current);
			widgetRef.current = null;
			setToken(null);
		};
	}, [siteKey, action]);

	const reset = useCallback(() => {
		setToken(null);
		if (widgetRef.current) turnstile.reset(widgetRef.current);
	}, []);

	return { containerRef, token, failure, reset };
}
