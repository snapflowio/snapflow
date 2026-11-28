/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	abuseAppealQueryOptions,
	appealAbuseDecisionMutationOptions,
} from '#lib/api/abuse-appeals.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { submitMutation } from '#lib/components/form/submit.ts';
import {
	type HeaderAction,
	saveDiscardActions,
} from '#lib/components/page/header-actions.ts';
import {
	type AbuseAppealValues,
	abuseAppealSchema,
	EMPTY_ABUSE_APPEAL,
	toAppealAbuseDecision,
} from '#lib/features/abuse/lib/abuse-appeal.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

const SEND_LABEL = 'Submit appeal';

interface AbuseAppealFormConfig {
	counterNoticeRequired: () => boolean;
	send: (values: AbuseAppealValues) => Promise<void>;
}

function createAbuseAppealForm(config: AbuseAppealFormConfig) {
	return createAppForm(() => ({
		defaultValues: EMPTY_ABUSE_APPEAL,
		validationLogic: revalidateLogic(),
		validators: {
			onDynamic: abuseAppealSchema(config.counterNoticeRequired()),
		},
		onSubmit: ({ value }) => config.send(value),
	}));
}

type AbuseAppealAppForm = ReturnType<typeof createAbuseAppealForm>;

interface AbuseAppealFormStatus {
	dirty: boolean;
	submitting: boolean;
}

export class AbuseAppealForm {
	readonly #permission = getOrganizationPermission();
	readonly query;
	readonly #submit;

	readonly canWrite = $derived(this.#permission.can({ sandboxes: ['write'] }));
	readonly counterNoticeRequired = $derived.by(
		() => this.query.data?.counterNoticeRequired ?? false
	);
	readonly open = $derived.by(
		() => Boolean(this.query.data?.appealable) && this.canWrite
	);

	readonly form: AbuseAppealAppForm;
	readonly #status: { readonly current: AbuseAppealFormStatus };

	readonly actions: HeaderAction[] = $derived(
		this.open
			? saveDiscardActions({
					dirty: this.dirty,
					saving: this.sending,
					saveLabel: SEND_LABEL,
					onSave: () => void this.form.handleSubmit(),
					onDiscard: () => this.discard(),
				})
			: []
	);

	constructor(caseId: () => string) {
		this.query = createQuery(() => abuseAppealQueryOptions(caseId()));
		this.#submit = createMutation(() =>
			appealAbuseDecisionMutationOptions(caseId())
		);
		this.form = createAbuseAppealForm({
			counterNoticeRequired: () => this.counterNoticeRequired,
			send: (values) => this.#send(values),
		});
		this.#status = this.form.useSelector((state) => ({
			dirty: !state.isDefaultValue,
			submitting: state.isSubmitting,
		}));
	}

	get dirty(): boolean {
		return this.#status.current.dirty;
	}

	get sending(): boolean {
		return this.#status.current.submitting || this.#submit.isPending;
	}

	discard = (): void => {
		this.form.reset();
	};

	async #send(values: AbuseAppealValues): Promise<void> {
		if (!this.open) return;
		const sent = await submitMutation(() =>
			this.#submit.mutateAsync(
				toAppealAbuseDecision(values, this.counterNoticeRequired)
			)
		);
		if (sent) this.form.reset();
	}
}
