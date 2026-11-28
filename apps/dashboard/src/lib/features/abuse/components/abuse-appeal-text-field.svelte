<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { FullAutoFill } from 'svelte/elements';
import {
	ABUSE_APPEAL_LIMITS,
	type AbuseAppealTextField,
} from '#lib/features/abuse/lib/abuse-appeal.ts';
import type { AbuseAppealForm } from '#lib/features/abuse/state/abuse-appeal-form.svelte.ts';

interface AbuseAppealTextFieldProps {
	appeal: AbuseAppealForm;
	name: AbuseAppealTextField;
	label: string;
	hint?: string;
	placeholder?: string;
	multiline?: boolean;
	autocomplete?: FullAutoFill;
}

let {
	appeal,
	name,
	label,
	hint,
	placeholder,
	multiline = false,
	autocomplete,
}: AbuseAppealTextFieldProps = $props();
</script>

<appeal.form.AppField {name}>
	{#snippet children(field)}
		{#if multiline}
			<field.TextareaField
				{label}
				{placeholder}
				{autocomplete}
				maxlength={ABUSE_APPEAL_LIMITS.TEXT_MAX_LENGTH}
				disabled={appeal.sending}
			/>
		{:else}
			<field.TextField
				{label}
				{hint}
				{placeholder}
				{autocomplete}
				maxlength={ABUSE_APPEAL_LIMITS.SHORT_TEXT_MAX_LENGTH}
				disabled={appeal.sending}
			/>
		{/if}
	{/snippet}
</appeal.form.AppField>
