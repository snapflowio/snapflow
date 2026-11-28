<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const WRITE_REQUIRED = 'You need sandbox write access to manage domains';
const DOMAINS_INFO =
	'Serve a preview port on your own domain. Point a CNAME at Snapflow, then add the TXT record to verify it.';
</script>

<script lang="ts">
import Globe from '@lucide/svelte/icons/globe';
import Plus from '@lucide/svelte/icons/plus';
import { CustomDomainState } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import {
	type SandboxCustomDomain,
	sandboxCustomDomainsQueryOptions,
} from '#lib/api/sandboxes/custom-domains.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import {
	CUSTOM_DOMAIN_STATE_BADGE,
	customDomainSummary,
	needsDnsRecords,
} from '#lib/features/custom-domains/lib/custom-domain-format.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import AddCustomDomainModal from './add-custom-domain-modal.svelte';
import RemoveCustomDomainModal from './remove-custom-domain-modal.svelte';

const detail = getSandboxDetail();
const domainsQuery = createQuery(() =>
	sandboxCustomDomainsQueryOptions(detail.sandbox.id)
);
const domains = $derived(domainsQuery.data ?? []);
const canAdd = $derived(detail.canWrite && domainsQuery.isSuccess);
let addOpen = $state(false);
let removeTarget = $state.raw<SandboxCustomDomain | null>(null);
</script>

{#snippet addAction()}
	<Chip
		size="compact"
		leftIcon={Plus}
		disabled={!canAdd}
		disabledReason={detail.canWrite ? undefined : WRITE_REQUIRED}
		onclick={() => (addOpen = true)}
	>
		Add domain
	</Chip>
{/snippet}

<SettingsSection
	title="Custom domains"
	description={DOMAINS_INFO}
	action={addAction}
>
	{#if domainsQuery.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			message="Couldn't load custom domains"
			retrying={domainsQuery.isFetching}
			onRetry={() => void domainsQuery.refetch()}
		/>
	{:else if domainsQuery.isSuccess && domains.length === 0}
		<EmptyState
			icon={Globe}
			title="No custom domains yet"
			description="Add a domain to serve a preview port on it."
		/>
	{/if}
	{#each domains as domain (domain.id)}
		{const stateBadge = $derived(CUSTOM_DOMAIN_STATE_BADGE[domain.state])}
		<SettingsResourceRow
			title={domain.hostname}
			meta={customDomainSummary(domain)}
		>
			{#snippet badge()}
				<Badge variant={stateBadge.variant}>{stateBadge.label}</Badge>
			{/snippet}
			{#snippet trailing()}
				<Chip
					size="compact"
					disabled={!detail.canWrite ||
						domain.state === CustomDomainState.Deleting}
					onclick={() => {
						removeTarget = domain;
					}}
				>
					Remove
				</Chip>
			{/snippet}
		</SettingsResourceRow>
		{#if needsDnsRecords(domain)}
			<div data-settings-row="" class="flex flex-col gap-3">
				<SettingsRow layout="stacked" label={`CNAME ${domain.hostname}`}>
					<ChipCopyInput
						value={domain.cnameTarget}
						aria-label={`CNAME ${domain.hostname}`}
						copyLabel="Copy CNAME target"
					/>
				</SettingsRow>
				{#each domain.verificationRecords as record (record.name +
					record.value)}
					<SettingsRow layout="stacked" label={`${record.type} ${record.name}`}>
						<ChipCopyInput
							value={record.value}
							aria-label={`${record.type} ${record.name}`}
							copyLabel={`Copy ${record.type} value for ${record.name}`}
						/>
					</SettingsRow>
				{/each}
			</div>
		{/if}
	{/each}
</SettingsSection>
<AddCustomDomainModal bind:open={addOpen} sandboxId={detail.sandbox.id} />
<RemoveCustomDomainModal
	domain={removeTarget}
	sandboxId={detail.sandbox.id}
	onClose={() => (removeTarget = null)}
/>
