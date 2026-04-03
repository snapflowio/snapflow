/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

export function useIsMobile() {
	const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

	useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		const onChange = () => {
			setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		};

		mql.addEventListener('change', onChange);
		setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		return () => mql.removeEventListener('change', onChange);
	}, []);

	return !!isMobile;
}

export function useIsBetweenMdAndLg() {
	const [isBetween, setIsBetween] = useState<boolean | undefined>(undefined);

	useEffect(() => {
		const mql = window.matchMedia(
			`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${DESKTOP_BREAKPOINT - 1}px)`
		);
		const onChange = () => {
			setIsBetween(
				window.innerWidth >= MOBILE_BREAKPOINT &&
					window.innerWidth < DESKTOP_BREAKPOINT
			);
		};

		mql.addEventListener('change', onChange);
		setIsBetween(
			window.innerWidth >= MOBILE_BREAKPOINT &&
				window.innerWidth < DESKTOP_BREAKPOINT
		);
		return () => mql.removeEventListener('change', onChange);
	}, []);

	return !!isBetween;
}
