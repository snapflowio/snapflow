/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	AnyFieldLikeMeta,
	AnyFieldLikeMetaBase,
	Updater,
} from '@tanstack/svelte-form';
import type { EventHandler } from 'svelte/elements';
import type { ApiFieldErrors } from '#lib/api/errors/api-field-errors.ts';

interface SubmittableForm {
	handleSubmit: () => unknown;
}

interface ServerErrorForm<Field extends string> {
	getFieldMeta: (field: Field) => AnyFieldLikeMeta | undefined;
	setFieldMeta: (field: Field, updater: Updater<AnyFieldLikeMetaBase>) => void;
}

export function formSubmitHandler(
	form: SubmittableForm
): EventHandler<SubmitEvent, HTMLFormElement> {
	return (event) => {
		event.preventDefault();
		event.stopPropagation();
		void form.handleSubmit();
	};
}

export async function submitMutation(
	submit: () => Promise<unknown>
): Promise<boolean> {
	try {
		await submit();
		return true;
	} catch {
		return false;
	}
}

export function setServerFieldErrors<Field extends string>(
	form: ServerErrorForm<Field>,
	errors: ApiFieldErrors<Field>
): void {
	for (const [field, message] of Object.entries(errors) as [Field, string][]) {
		if (!form.getFieldMeta(field)) continue;
		form.setFieldMeta(field, (meta) => ({
			...meta,
			isTouched: true,
			errorMap: { ...meta.errorMap, onServer: message },
		}));
	}
}
