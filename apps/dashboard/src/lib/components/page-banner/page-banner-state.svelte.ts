/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { untrack } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

export const PageBannerKind = {
	Impersonation: 'impersonation',
	Offline: 'offline',
	BillingBlocked: 'billing-blocked',
	PayoutsBlocked: 'payouts-blocked',
} as const;

export type PageBannerKind =
	(typeof PageBannerKind)[keyof typeof PageBannerKind];

const PRIORITY: readonly PageBannerKind[] = [
	PageBannerKind.Impersonation,
	PageBannerKind.Offline,
	PageBannerKind.BillingBlocked,
	PageBannerKind.PayoutsBlocked,
];

export type PageBannerVariant = 'default' | 'destructive';

export type PageBannerAction =
	| { label: string; href: string }
	| {
			label: string;
			onSelect: () => void;
			disabled?: boolean;
			loading?: boolean;
	  };

export interface PageBannerCountdown {
	endsAt: number;
	suffix: string;
}

export interface PageBannerItem {
	kind: PageBannerKind;
	variant: PageBannerVariant;
	message: string;
	description?: string;
	countdown?: PageBannerCountdown;
	action?: PageBannerAction;
}

class PageBannerState {
	readonly #items = new SvelteMap<PageBannerKind, PageBannerItem>();
	#claims = $state(0);

	readonly current: PageBannerItem | undefined = $derived(
		PRIORITY.map((kind) => this.#items.get(kind)).find(
			(item) => item !== undefined
		)
	);

	readonly claimed = $derived(this.#claims > 0);

	show(item: PageBannerItem): () => void {
		this.#items.set(item.kind, item);
		return () => {
			if (this.#items.get(item.kind) === item) this.#items.delete(item.kind);
		};
	}

	claim(): () => void {
		untrack(() => {
			this.#claims += 1;
		});
		return () => {
			untrack(() => {
				this.#claims -= 1;
			});
		};
	}
}

export const pageBanner = new PageBannerState();

export function usePageBanner(item: () => PageBannerItem | null): void {
	$effect(() => {
		const current = item();
		if (!current) return;
		return pageBanner.show(current);
	});
}
