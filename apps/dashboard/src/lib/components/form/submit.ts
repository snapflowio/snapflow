/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EventHandler } from 'svelte/elements';

interface SubmittableForm {
	handleSubmit: () => unknown;
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
