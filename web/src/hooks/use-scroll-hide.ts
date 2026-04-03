/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useEffect, useRef, useState } from 'react';

const DEFAULT_SCROLL_THRESHOLD = 48;

export function useScrollHide(threshold = DEFAULT_SCROLL_THRESHOLD) {
	const [isHidden, setIsHidden] = useState(false);
	const lastScrollY = useRef(0);

	useEffect(() => {
		lastScrollY.current = window.scrollY;

		const handleScroll = () => {
			const currentY = window.scrollY;
			const delta = currentY - lastScrollY.current;

			if (currentY <= 0) {
				setIsHidden(false);
				lastScrollY.current = currentY;
				return;
			}

			if (Math.abs(delta) < threshold) {
				return;
			}

			if (delta > 0) {
				setIsHidden(true);
			} else {
				setIsHidden(false);
			}

			lastScrollY.current = currentY;
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	}, [threshold]);

	return isHidden;
}
