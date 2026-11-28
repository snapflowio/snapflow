<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import PageSection from '#lib/components/detail/page-section.svelte';
import FieldError from '#lib/components/form/field-error.svelte';
import LabeledCheckbox from '#lib/components/ui/checkbox/labeled-checkbox.svelte';
import AbuseAppealTextField from '#lib/features/abuse/components/abuse-appeal-text-field.svelte';
import type { AbuseAppealStatement } from '#lib/features/abuse/lib/abuse-appeal.ts';
import type { AbuseAppealForm } from '#lib/features/abuse/state/abuse-appeal-form.svelte.ts';

interface CounterNoticeFieldsProps {
	appeal: AbuseAppealForm;
}

let { appeal }: CounterNoticeFieldsProps = $props();
</script>

{#snippet statement(name: AbuseAppealStatement, text: string)}
	<appeal.form.Field {name}>
		{#snippet children(field)}
			<div class="flex flex-col gap-1">
				<LabeledCheckbox
					checked={field.state.value}
					disabled={appeal.sending}
					onCheckedChange={field.handleChange}
				>
					{text}
				</LabeledCheckbox>
				<FieldError class="pl-6.5" errors={field.state.meta.errors} />
			</div>
		{/snippet}
	</appeal.form.Field>
{/snippet}

<PageSection
	title="DMCA counter-notice"
	info="Copyright takedowns are restored only through a counter-notice under 17 U.S.C. § 512(g)(3). We forward it to the person who reported the material; if they do not file a court action within 10 to 14 business days, we restore access."
>
	<div class="flex flex-col gap-y-6">
		<AbuseAppealTextField
			{appeal}
			name="removedMaterial"
			label="Removed material"
			placeholder="The material that was removed and the URL where it appeared"
			multiline
		/>
		{@render statement(
			'goodFaithMistake',
			'I swear, under penalty of perjury, that I have a good faith belief the material was removed or disabled as a result of mistake or misidentification of the material.'
		)}
		{@render statement(
			'consentToJurisdiction',
			'I consent to the jurisdiction of the Federal District Court for the judicial district of my address, or any judicial district in which Snapflow may be found if my address is outside the United States, and I will accept service of process from the person who reported the material or their agent.'
		)}
		<AbuseAppealTextField
			{appeal}
			name="address"
			label="Postal address"
			autocomplete="street-address"
			multiline
		/>
		<AbuseAppealTextField
			{appeal}
			name="phone"
			label="Telephone"
			autocomplete="tel"
		/>
		<AbuseAppealTextField
			{appeal}
			name="signature"
			label="Signature"
			hint="Type your full legal name as your electronic signature."
			autocomplete="name"
		/>
	</div>
</PageSection>
