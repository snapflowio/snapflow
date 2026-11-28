/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const VISIBILITY_ROOT_MARGIN = '200px 0px';

export function observeVisibility(target: Element | null) {
	let visible = true;
	if (!target) return { current: () => visible, dispose: () => undefined };
	const observer = new IntersectionObserver(
		([entry]) => {
			visible = entry?.isIntersecting ?? true;
		},
		{ threshold: 0, rootMargin: VISIBILITY_ROOT_MARGIN }
	);
	observer.observe(target);
	return {
		current: () => visible,
		dispose: () => observer.disconnect(),
	};
}
