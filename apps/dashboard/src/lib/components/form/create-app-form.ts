/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createFormCreator } from '@tanstack/svelte-form';
import DurationField from './duration-field.svelte';
import KeyValueField from './key-value-field.svelte';
import MultiSelectField from './multi-select-field.svelte';
import SelectField from './select-field.svelte';
import SubmitButton from './submit-button.svelte';
import SwitchField from './switch-field.svelte';
import TextField from './text-field.svelte';
import TextareaField from './textarea-field.svelte';

export const { createAppForm, getFormType } = createFormCreator({
	fieldComponents: {
		DurationField,
		KeyValueField,
		MultiSelectField,
		SelectField,
		SwitchField,
		TextField,
		TextareaField,
	},
	formComponents: {
		SubmitButton,
	},
});
