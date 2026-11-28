<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { AbuseReportCategory } from '@snapflow/api-client';
import { ABUSE_CATEGORY_LABEL } from '#lib/features/abuse/lib/abuse-appeal.ts';

const CATEGORY_OPTIONS = Object.values(AbuseReportCategory).map((value) => ({
	value,
	label: ABUSE_CATEGORY_LABEL[value],
}));
const URL_QUERY_PARAMETER = 'url';
const DEFAULT_CATEGORY = AbuseReportCategory.Phishing;
const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

function isReportableUrl(value: string): boolean {
	return URL.canParse(value) && ALLOWED_PROTOCOLS.has(new URL(value).protocol);
}

interface ReportAbuseModalProps {
	open: boolean;
	abuseHref: string;
	onClose: () => void;
}
</script>

<script lang="ts">
import { createMutation } from '@tanstack/svelte-query';
import { submitSignedInAbuseReportMutationOptions } from '#lib/api/abuse-reports.ts';
import LabeledCheckbox from '#lib/components/ui/checkbox/labeled-checkbox.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipTextarea from '#lib/components/ui/chip/chip-textarea.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import Notice from '#lib/components/ui/notice.svelte';

let { open, abuseHref, onClose }: ReportAbuseModalProps = $props();

const categoryId = $props.id();
const urlId = `${categoryId}-url`;
const descriptionId = `${categoryId}-description`;
const submission = createMutation(() =>
	submitSignedInAbuseReportMutationOptions()
);

let category = $state<AbuseReportCategory>(DEFAULT_CATEGORY);
let url = $state('');
let description = $state('');
let goodFaith = $state(false);

const pending = $derived(submission.isPending);
const copyright = $derived(category === AbuseReportCategory.Copyright);
const publicFormHref = $derived.by(() => {
	const href = new URL(abuseHref);
	if (url.trim()) href.searchParams.set(URL_QUERY_PARAMETER, url.trim());
	return href.href;
});
const ready = $derived(
	!copyright &&
		isReportableUrl(url.trim()) &&
		description.trim().length > 0 &&
		goodFaith
);

function submit() {
	if (pending || !ready) return;
	submission.mutate(
		{
			category,
			url: url.trim(),
			description: description.trim(),
			goodFaith,
		},
		{ onSuccess: close }
	);
}

function close() {
	category = DEFAULT_CATEGORY;
	url = '';
	description = '';
	goodFaith = false;
	submission.reset();
	onClose();
}

function setOpen(next: boolean) {
	if (!next) close();
}
</script>

<ChipModal
	bind:open={() => open, setOpen}
	onsubmit={submit}
	srTitle="Report abuse"
	dismissDisabled={pending}
	variant="sheet"
>
	<ChipModalHeader onClose={close} closeDisabled={pending}>
		Report abuse
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField label="Category" for={categoryId} required>
			<ChipDropdown
				id={categoryId}
				options={CATEGORY_OPTIONS}
				bind:value={category}
				align="start"
				fullWidth
				disabled={pending}
			/>
		</ChipModalField>
		<ChipModalField
			label="URL"
			for={urlId}
			required
			hint="The exact address of the content. Never attach or upload the content itself."
		>
			<ChipInput
				id={urlId}
				type="url"
				bind:value={url}
				placeholder="https://"
				autocomplete="off"
				disabled={pending}
			/>
		</ChipModalField>
		{#if copyright}
			<Notice>
				{#snippet title()}
					Copyright reports need a full DMCA notice
				{/snippet}
				{#snippet info()}
					Send it through the
					<a
						class="underline underline-offset-4"
						href={publicFormHref}
						target="_blank"
						rel="noopener noreferrer"
						>public abuse form</a
					>, which asks for every element 17 U.S.C. § 512(c)(3) requires.
				{/snippet}
			</Notice>
		{:else}
			<ChipModalField label="What is wrong" for={descriptionId} required>
				<ChipTextarea
					id={descriptionId}
					bind:value={description}
					placeholder="Describe the abuse and how you found it"
					disabled={pending}
				/>
			</ChipModalField>
			<LabeledCheckbox bind:checked={goodFaith} disabled={pending}>
				I believe in good faith that this report is accurate.
			</LabeledCheckbox>
		{/if}
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={pending}>
		{#snippet primaryAction()}
			<Chip
				loading={pending}
				type="submit"
				variant="primary"
				disabled={pending || !ready}
			>
				Send report
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
