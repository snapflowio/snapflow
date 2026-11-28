/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ResourceSegment } from '#lib/components/resource/resource-options.ts';
import { goto } from '$app/navigation';
import { page } from '$app/state';

const VIEW_PARAM = 'view';

export interface AdminViewSwitch {
	readonly segments: readonly ResourceSegment[];
	readonly segment: string;
	readonly onSegmentChange: (value: string) => void;
}

export class AdminViewParam<const TView extends string> {
	readonly #views: readonly [
		ResourceSegment<TView>,
		...ResourceSegment<TView>[],
	];

	readonly current: TView = $derived.by(() => {
		const requested = page.url.searchParams.get(VIEW_PARAM);
		return (
			this.#views.find((view) => view.value === requested)?.value ??
			this.#views[0].value
		);
	});

	readonly switch: AdminViewSwitch = $derived.by(() => ({
		segments: this.#views,
		segment: this.current,
		onSegmentChange: this.select,
	}));

	constructor(
		views: readonly [ResourceSegment<TView>, ...ResourceSegment<TView>[]]
	) {
		this.#views = views;
	}

	select = (value: string): void => {
		if (value === this.current) return;
		const url = new URL(page.url.href);
		url.search = '';
		if (value !== this.#views[0].value) url.searchParams.set(VIEW_PARAM, value);
		void goto(url, { reset: false });
	};
}
