/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	StripeCheckoutLoadActionsSuccess,
	StripePaymentElement,
} from '@stripe/stripe-js';
import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { Debounced, watch } from 'runed';
import type { Attachment } from 'svelte/attachments';
import {
	createTopUpMutationOptions,
	resizeTopUp,
} from '#lib/api/billing/billing.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import { announceTopUp } from '#lib/features/billing/lib/top-up-result.ts';
import { getStripePromise } from '#lib/integrations/stripe/stripe.ts';
import {
	dashboardConnectFonts,
	dashboardElementsAppearance,
} from '#lib/integrations/stripe/stripe-appearance.ts';

const CHECKOUT_LOAD_ERROR = 'Checkout could not be loaded.';
const TOP_UP_NOT_OPEN_CODE = 'top_up_not_open';
const PAYMENT_ELEMENT_LAYOUT = 'tabs';
const SAVED_PAYMENT_METHOD_OPTION = 'auto';
const AMOUNT_SYNC_DELAY_MILLISECONDS = 400;

interface TopUpCheckoutSession {
	topUpId: string;
	clientSecret: string;
}

export class TopUpCheckout {
	readonly #stripePromise = getStripePromise();
	readonly #queryClient = useQueryClient();
	readonly #createTopUp = createMutation(() => createTopUpMutationOptions());
	readonly #amountCents: () => number | null;
	readonly #requestedCents: Debounced<number | null>;
	readonly #onDone: () => void;

	session = $state.raw<TopUpCheckoutSession | null>(null);
	ready = $state(false);
	paying = $state(false);
	errorMessage = $state<string | null>(null);
	#actions = $state.raw<StripeCheckoutLoadActionsSuccess | null>(null);
	#syncedCents = $state<number | null>(null);
	#failedCents = $state<number | null>(null);
	#syncing = $state(false);
	#totalCents = $state<number | null>(null);

	readonly #amountSettled = $derived.by(() => {
		const cents = this.#amountCents();
		return cents !== null && cents === this.#syncedCents && !this.#syncing;
	});
	readonly payCents = $derived.by(() =>
		this.#amountSettled && this.#totalCents !== null
			? this.#totalCents
			: this.#amountCents()
	);
	readonly canPay = $derived(
		this.ready && this.#actions !== null && this.#amountSettled && !this.paying
	);
	readonly createError = $derived(
		this.#createTopUp.isError
			? SnapflowError.fromUnknown(this.#createTopUp.error).message
			: null
	);

	constructor(amountCents: () => number | null, onDone: () => void) {
		this.#amountCents = amountCents;
		this.#onDone = onDone;
		this.#requestedCents = new Debounced(
			amountCents,
			AMOUNT_SYNC_DELAY_MILLISECONDS
		);

		watch(
			[amountCents, () => this.session, () => this.#createTopUp.isIdle],
			([cents, session, idle]) => {
				if (session || cents === null || !idle) return;
				this.#open(cents);
			}
		);

		watch(
			[
				() => this.#requestedCents.current,
				() => this.#actions,
				() => this.session,
				() => this.#syncing,
				() => this.paying,
			],
			([target, actions, session, syncing, paying]) => {
				if (
					!actions ||
					!session ||
					syncing ||
					paying ||
					target === null ||
					target === this.#syncedCents ||
					target === this.#failedCents
				) {
					return;
				}
				void this.#resize(actions, session.topUpId, target);
			}
		);
	}

	restart = (): void => {
		this.session = null;
		this.#syncedCents = null;
		this.#createTopUp.reset();
	};

	readonly paymentElement = (
		clientSecret: string
	): Attachment<HTMLDivElement> => {
		return (node) => {
			let element: StripePaymentElement | null = null;
			let disposed = false;
			this.errorMessage = null;
			this.#stripePromise
				.then(async (stripe) => {
					if (!stripe) throw new Error(CHECKOUT_LOAD_ERROR);
					if (disposed) return;
					const sdk = stripe.initCheckoutElementsSdk({
						clientSecret,
						elementsOptions: {
							appearance: dashboardElementsAppearance(),
							fonts: dashboardConnectFonts(),
							savedPaymentMethod: {
								enableSave: SAVED_PAYMENT_METHOD_OPTION,
								enableRedisplay: SAVED_PAYMENT_METHOD_OPTION,
							},
						},
					});
					sdk.on('change', (next) => {
						this.#totalCents = next.total.total.minorUnitsAmount;
					});
					element = sdk.createPaymentElement({
						layout: PAYMENT_ELEMENT_LAYOUT,
					});
					element.on('ready', () => {
						this.ready = true;
					});
					element.mount(node);
					const loaded = await sdk.loadActions();
					if (disposed) return;
					if (loaded.type === 'error') throw new Error(loaded.error.message);
					this.#actions = loaded.actions;
					this.#totalCents =
						loaded.actions.getSession().total.total.minorUnitsAmount;
				})
				.catch((error: unknown) => {
					if (!disposed) {
						this.errorMessage =
							error instanceof Error ? error.message : CHECKOUT_LOAD_ERROR;
					}
				});
			return () => {
				disposed = true;
				element?.destroy();
				this.#actions = null;
				this.ready = false;
				this.#totalCents = null;
			};
		};
	};

	pay = async (event: SubmitEvent): Promise<void> => {
		event.preventDefault();
		const actions = this.#actions;
		if (!actions || !this.session || !this.canPay) return;
		const { topUpId } = this.session;
		this.paying = true;
		this.errorMessage = null;
		try {
			const result = await actions.confirm({ redirect: 'if_required' });
			if (result.type === 'error') {
				this.errorMessage = result.error.message;
				return;
			}
			await announceTopUp(this.#queryClient, topUpId);
			this.#onDone();
		} finally {
			this.paying = false;
		}
	};

	#open(cents: number): void {
		this.errorMessage = null;
		this.#createTopUp.mutate(
			{ amountCents: cents },
			{
				onSuccess: (created) => {
					this.#syncedCents = cents;
					this.#failedCents = null;
					this.session = {
						topUpId: created.topUpId,
						clientSecret: created.checkoutClientSecret,
					};
				},
			}
		);
	}

	async #resize(
		actions: StripeCheckoutLoadActionsSuccess,
		topUpId: string,
		cents: number
	): Promise<void> {
		this.#syncing = true;
		this.errorMessage = null;
		try {
			const result = await actions.runServerUpdate(() =>
				resizeTopUp(topUpId, cents)
			);
			if (result.type === 'error') {
				this.#failedCents = cents;
				this.errorMessage = result.error.message;
				return;
			}
			this.#syncedCents = cents;
			this.#failedCents = null;
			this.#totalCents = result.session.total.total.minorUnitsAmount;
		} catch (error) {
			const failure = SnapflowError.fromUnknown(error);
			if (failure.code === TOP_UP_NOT_OPEN_CODE) {
				this.restart();
				return;
			}
			this.#failedCents = cents;
			this.errorMessage = failure.message;
		} finally {
			this.#syncing = false;
		}
	}
}
