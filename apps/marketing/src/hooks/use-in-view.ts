/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useEffect, useRef, useState } from 'react';

export function useInView<T extends Element>() {
	const ref = useRef<T>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		if (!('IntersectionObserver' in window)) {
			setVisible(true);
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => setVisible(Boolean(entry?.isIntersecting)),
			{ threshold: 0, rootMargin: '200px 0px' }
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	return { ref, visible };
}
