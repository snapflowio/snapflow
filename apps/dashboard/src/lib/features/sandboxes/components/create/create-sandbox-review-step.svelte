<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->
<script lang="ts" module>
import { PlacementKind, SandboxMode } from '@snapflow/api-client';
import {
	MACHINE_CATEGORY_LABELS,
	MACHINE_TIER_LABELS,
} from '#lib/features/listings/lib/listing-format.ts';
import {
	AUTOMATIC_LOCATION_LABEL,
	locationCodeLabel,
} from '#lib/features/locations/lib/location-format.ts';
import {
	AUTO_ARCHIVE_OPTIONS,
	AUTO_DELETE_OPTIONS,
	AUTO_STOP_OPTIONS,
	DEFAULT_AUTO_STOP_MINUTES,
	formatDuration,
	formatSandboxCapabilities,
} from '#lib/features/sandboxes/lib/create/create-sandbox-options.ts';
import {
	type CreateSandboxValues,
	nonEmptyLines,
	SOURCE,
} from '#lib/features/sandboxes/lib/create/create-sandbox-schema.ts';
import { splitAllowList } from '#lib/features/sandboxes/lib/sandbox-network-policy.ts';
import { formatCount } from '#lib/utils/format.ts';

const ANY_CONSTRAINT = 'Any';
const NONE_LABEL = 'None';

const lineCount = (value: string) => nonEmptyLines(value).length || NONE_LABEL;
const allowList = (value: string) =>
	splitAllowList(value).join(', ') || NONE_LABEL;

function sourceLabel(values: CreateSandboxValues): string {
	return values.source === SOURCE.IMAGE
		? values.image.trim() || 'Not set'
		: values.snapshot || 'Snapflow default snapshot';
}

function categoryLabel(values: CreateSandboxValues): string {
	return values.placementCategory
		? MACHINE_CATEGORY_LABELS[values.placementCategory]
		: ANY_CONSTRAINT;
}

function tierLabel(values: CreateSandboxValues): string {
	return values.minimumTier
		? MACHINE_TIER_LABELS[values.minimumTier]
		: ANY_CONSTRAINT;
}

function locationLabel(values: CreateSandboxValues): string {
	const locations = values.locations.map(locationCodeLabel).join(', ');
	const placement = locations || AUTOMATIC_LOCATION_LABEL;
	const scoped = values.ownMachinesOnly
		? `${placement} · own machines`
		: placement;
	return values.interruptible ? `${scoped} · interruptible` : scoped;
}

function optionalLabel(
	value: string,
	format: (trimmed: string) => string,
	emptyLabel: string
): string {
	const trimmed = value.trim();
	return trimmed ? format(trimmed) : emptyLabel;
}
</script>

<script lang="ts">
import type { SandboxPlacementAlternative } from '@snapflow/api-client';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ChipModalReviewSection from '#lib/components/ui/chip-modal/chip-modal-review-section.svelte';
import SandboxAttentionNotice from '#lib/features/sandboxes/components/sandbox-attention-notice.svelte';
import type { PlacementError } from '#lib/features/sandboxes/lib/placement-errors.ts';
import { placementErrorAttention } from '#lib/features/sandboxes/lib/sandbox-attention.ts';
import SandboxQuoteSummary, {
	type SandboxQuoteView,
} from './sandbox-quote-summary.svelte';

interface CreateSandboxReviewStepProps {
	onUseMachine: (alternative: SandboxPlacementAlternative) => void;
	onWholeMachineChange: (wholeMachine: boolean) => void;
	placementError: PlacementError | null;
	quote: SandboxQuoteView;
	values: CreateSandboxValues;
}

let {
	onUseMachine,
	onWholeMachineChange,
	placementError,
	quote,
	values,
}: CreateSandboxReviewStepProps = $props();

const pinned = $derived(values.placementKind === PlacementKind.Pinned);
const wholeMachine = $derived(pinned && values.wholeMachine);
const ephemeral = $derived(values.mode === SandboxMode.Ephemeral);
const placementLabel = $derived.by(() => {
	if (wholeMachine) return 'Whole machine';
	if (pinned) return 'Specific machine';
	return 'Any matching machine';
});
</script>

<div class="flex flex-col gap-y-8">
	<ChipModalReviewSection title="Basics">
		<KeyValueRow
			align="end"
			label="Name"
			value={values.name.trim() || 'Generated automatically'}
		/>
		<KeyValueRow align="end" label="Source" value={sourceLabel(values)} />
		<KeyValueRow align="end" label="Placement" value={placementLabel} />
		{#if pinned}
			<KeyValueRow align="end" label="Machine" value={values.machineId} />
		{:else}
			<KeyValueRow align="end" label="Location" value={locationLabel(values)} />
			<KeyValueRow align="end" label="Category" value={categoryLabel(values)} />
			<KeyValueRow align="end" label="Minimum tier" value={tierLabel(values)} />
		{/if}
		<KeyValueRow
			align="end"
			label="Max $/h"
			value={optionalLabel(
				values.maxHourlyPriceUsd,
				(price) => `$${price}`,
				'No limit'
			)}
		/>
		<KeyValueRow
			align="end"
			label="Capabilities"
			value={formatSandboxCapabilities(values.capabilities) ?? NONE_LABEL}
		/>
		<KeyValueRow
			align="end"
			label="Mode"
			value={ephemeral ? 'Temporary' : 'Persistent'}
		/>
	</ChipModalReviewSection>
	<ChipModalReviewSection title="Lifecycle and network">
		<KeyValueRow
			align="end"
			label="Stop after inactivity"
			value={formatDuration(
				values.autoStopInterval,
				`${DEFAULT_AUTO_STOP_MINUTES} minutes`,
				AUTO_STOP_OPTIONS
			)}
		/>
		<KeyValueRow
			align="end"
			label="Archive after stopping"
			value={formatDuration(
				values.autoArchiveInterval,
				'7 days',
				AUTO_ARCHIVE_OPTIONS
			)}
		/>
		<KeyValueRow
			align="end"
			label="Delete"
			value={ephemeral
				? 'When stopped'
				: formatDuration(
						values.autoDeleteInterval,
						'Never',
						AUTO_DELETE_OPTIONS
					)}
		/>
		<KeyValueRow
			align="end"
			label="Outbound internet"
			value={values.networkBlockAll ? 'Blocked' : 'Allowed'}
		/>
		<KeyValueRow
			align="end"
			label="CIDR allow list"
			value={allowList(values.networkAllowList)}
		/>
		<KeyValueRow
			align="end"
			label="Domain allow list"
			value={allowList(values.domainAllowList)}
		/>
		<KeyValueRow
			align="end"
			label="Egress bandwidth"
			value={optionalLabel(
				values.egressBandwidthBps,
				(bandwidth) => `${formatCount(Number(bandwidth))} bps`,
				'Organization setting'
			)}
		/>
	</ChipModalReviewSection>
	<ChipModalReviewSection title="Environment and storage">
		<KeyValueRow
			align="end"
			label="Environment variables"
			value={lineCount(values.environment)}
		/>
		<KeyValueRow
			align="end"
			label="Secret variables"
			value={lineCount(values.secretBindings)}
		/>
		<KeyValueRow
			align="end"
			label="Volumes"
			value={lineCount(values.volumeMounts)}
		/>
		<KeyValueRow align="end" label="Labels" value={lineCount(values.labels)} />
	</ChipModalReviewSection>
	{#if placementError}
		<SandboxAttentionNotice
			attention={placementErrorAttention(placementError)}
			{onUseMachine}
		/>
	{/if}
	<SandboxQuoteSummary {quote} {wholeMachine} {onWholeMachineChange} />
</div>
