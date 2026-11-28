/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	BillingProfile,
	UpdateBillingProfile,
} from '@snapflow/api-client';
import {
	type BillingProfileValues,
	billingProfileBody,
	billingProfileSchema,
	billingProfileValues,
} from '#lib/features/billing/lib/billing-profile.ts';

type ProfileField = keyof BillingProfileValues;
type ProfileErrors = Partial<Record<ProfileField, string>>;

const PROFILE_FIELDS = Object.keys(
	billingProfileSchema.shape
) as ProfileField[];

export class BillingProfileDraft {
	values = $state<BillingProfileValues>(billingProfileValues(null));
	#initial = $state.raw<BillingProfileValues>(billingProfileValues(null));
	#validated = $state(false);

	readonly dirty = $derived(
		PROFILE_FIELDS.some(
			(field) => this.values[field].trim() !== this.#initial[field].trim()
		)
	);
	readonly errors: ProfileErrors = $derived.by(() => {
		if (!this.#validated) return {};
		const result = billingProfileSchema.safeParse(this.values);
		if (result.success) return {};
		const errors: ProfileErrors = {};
		for (const issue of result.error.issues) {
			const [field] = issue.path;
			if (typeof field === 'string' && field in this.values) {
				errors[field as ProfileField] ??= issue.message;
			}
		}
		return errors;
	});

	reset(profile: BillingProfile | null): void {
		const values = billingProfileValues(profile);
		this.#initial = values;
		this.values = { ...values };
		this.#validated = false;
	}

	discard = (): void => {
		this.values = { ...this.#initial };
		this.#validated = false;
	};

	validate(): UpdateBillingProfile | null {
		this.#validated = true;
		const result = billingProfileSchema.safeParse(this.values);
		return result.success ? billingProfileBody(result.data) : null;
	}

	commit(): void {
		this.#initial = { ...this.values };
		this.#validated = false;
	}
}
