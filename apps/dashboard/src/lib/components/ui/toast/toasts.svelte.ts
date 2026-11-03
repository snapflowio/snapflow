/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SvelteMap } from 'svelte/reactivity';
import {
	AUTO_DISMISS_MS,
	STACK_LIMIT,
	type ToastData,
	type ToastInput,
} from './toast-model.ts';
import { layoutToastStack } from './toast-stack.ts';

type ToastOptions = Omit<ToastInput, 'message' | 'variant'>;

class ToastState {
	#items: readonly ToastData[] = $state.raw([]);
	readonly #heights = new SvelteMap<string, number>();
	#expanded = $state(false);
	readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();

	readonly stack = $derived(
		layoutToastStack(this.#items, this.#heights, this.#expanded)
	);

	get items(): readonly ToastData[] {
		return this.#items;
	}

	get expanded(): boolean {
		return this.#expanded;
	}

	set expanded(next: boolean) {
		this.#expanded = next;
		if (next) this.#clearTimers();
		else this.#startTimers();
	}

	add = (input: ToastInput): string => {
		const id = crypto.randomUUID();
		const next = [
			...this.items,
			{
				id,
				message: input.message,
				description: input.description,
				variant: input.variant ?? 'default',
				action: input.action,
				duration: input.duration ?? (input.action ? 0 : AUTO_DISMISS_MS),
				persistAcrossRoutes: input.persistAcrossRoutes ?? false,
			},
		];
		if (next.length > STACK_LIMIT) {
			const evictIndex = next.findIndex((toast) => toast.duration > 0);
			next.splice(evictIndex === -1 ? 0 : evictIndex, 1);
		}
		this.#setItems(next);
		return id;
	};

	dismiss = (id: string): void => {
		this.#setItems(this.items.filter((toast) => toast.id !== id));
	};

	measure = (id: string, height: number): void => {
		if (this.#heights.get(id) === height) return;
		if (this.items.some((toast) => toast.id === id)) {
			this.#heights.set(id, height);
		}
	};

	dismissAll = (): void => {
		this.#setItems([]);
	};

	leaveRoute = (): void => {
		if (this.items.some((toast) => !toast.persistAcrossRoutes)) {
			this.#setItems(this.items.filter((toast) => toast.persistAcrossRoutes));
		}
	};

	#setItems(next: readonly ToastData[]): void {
		this.#items = next;
		const live = new Set(next.map((toast) => toast.id));
		for (const id of this.#heights.keys()) {
			if (!live.has(id)) this.#heights.delete(id);
		}
		for (const [id, timer] of this.#timers) {
			if (live.has(id)) continue;
			clearTimeout(timer);
			this.#timers.delete(id);
		}
		if (next.length === 0) this.#expanded = false;
		else if (!this.#expanded) this.#startTimers();
	}

	#startTimers(): void {
		for (const toast of this.items) {
			if (toast.duration <= 0 || this.#timers.has(toast.id)) continue;
			this.#timers.set(
				toast.id,
				setTimeout(() => {
					this.#timers.delete(toast.id);
					this.dismiss(toast.id);
				}, toast.duration)
			);
		}
	}

	#clearTimers(): void {
		for (const timer of this.#timers.values()) clearTimeout(timer);
		this.#timers.clear();
	}
}

export const toasts = new ToastState();

export const toast = Object.assign((input: ToastInput) => toasts.add(input), {
	success: (message: string, options?: ToastOptions) =>
		toasts.add({ ...options, message, variant: 'success' }),
	error: (message: string, options?: ToastOptions) =>
		toasts.add({ ...options, message, variant: 'error' }),
	warning: (message: string, options?: ToastOptions) =>
		toasts.add({ ...options, message, variant: 'warning' }),
	info: (message: string, options?: ToastOptions) =>
		toasts.add({ ...options, message, variant: 'info' }),
	dismiss: (id: string) => toasts.dismiss(id),
	dismissAll: () => toasts.dismissAll(),
});
