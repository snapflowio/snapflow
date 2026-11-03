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

function constraintLabel(values: CreateSandboxValues): string {
	const category = values.placementCategory
		? MACHINE_CATEGORY_LABELS[values.placementCategory]
		: ANY_CONSTRAINT;
	const tier = values.minimumTier
		? MACHINE_TIER_LABELS[values.minimumTier]
		: ANY_CONSTRAINT;
	return `${category} · ${tier}`;
}

function locationLabel(values: CreateSandboxValues): string {
	const locations = values.locations.map(locationCodeLabel).join(', ');
	const placement = locations || AUTOMATIC_LOCATION_LABEL;
	return values.ownMachinesOnly ? `${placement} · own machines` : placement;
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
import ChipModalReviewRow from '#lib/components/ui/chip-modal/chip-modal-review-row.svelte';
import ChipModalReviewSection from '#lib/components/ui/chip-modal/chip-modal-review-section.svelte';
import SandboxPlacementErrorNotice from '#lib/features/sandboxes/components/sandbox-placement-error-notice.svelte';
import type { PlacementError } from '#lib/features/sandboxes/lib/placement-errors.ts';
import SandboxQuoteSummary, {
	type SandboxQuoteView,
} from './sandbox-quote-summary.svelte';

interface CreateSandboxReviewStepProps {
	onUseMachine: (alternative: SandboxPlacementAlternative) => void;
	placementError: PlacementError | null;
	quote: SandboxQuoteView;
	values: CreateSandboxValues;
}

let {
	onUseMachine,
	placementError,
	quote,
	values,
}: CreateSandboxReviewStepProps = $props();

const pinned = $derived(values.placementKind === PlacementKind.Pinned);
const ephemeral = $derived(values.mode === SandboxMode.Ephemeral);
</script>

<div class="flex flex-col gap-4 px-2">
	<div class="grid gap-3 sm:grid-cols-2">
		<ChipModalReviewSection title="Basics">
			<ChipModalReviewRow
				label="Name"
				value={values.name.trim() || 'Generated automatically'}
			/>
			<ChipModalReviewRow label="Source" value={sourceLabel(values)} />
			<ChipModalReviewRow
				label="Placement"
				value={pinned ? 'Specific machine' : 'Any matching machine'}
			/>
			{#if pinned}
				<ChipModalReviewRow label="Machine" value={values.machineId} />
			{:else}
				<ChipModalReviewRow label="Location" value={locationLabel(values)} />
				<ChipModalReviewRow
					label="Category · tier"
					value={constraintLabel(values)}
				/>
				<ChipModalReviewRow
					label="Max $/h"
					value={optionalLabel(
						values.maxHourlyPriceUsd,
						(price) => `$${price}`,
						'No limit'
					)}
				/>
			{/if}
			<ChipModalReviewRow
				label="Capabilities"
				value={formatSandboxCapabilities(values.capabilities) ?? NONE_LABEL}
			/>
			<ChipModalReviewRow
				label="Mode"
				value={ephemeral ? 'Temporary' : 'Persistent'}
			/>
		</ChipModalReviewSection>
		<ChipModalReviewSection title="Lifecycle and network">
			<ChipModalReviewRow
				label="Stop after inactivity"
				value={formatDuration(
					values.autoStopInterval,
					`${DEFAULT_AUTO_STOP_MINUTES} minutes`,
					AUTO_STOP_OPTIONS
				)}
			/>
			<ChipModalReviewRow
				label="Archive after stopping"
				value={formatDuration(
					values.autoArchiveInterval,
					'7 days',
					AUTO_ARCHIVE_OPTIONS
				)}
			/>
			<ChipModalReviewRow
				label="Delete"
				value={ephemeral
					? 'When stopped'
					: formatDuration(
							values.autoDeleteInterval,
							'Never',
							AUTO_DELETE_OPTIONS
						)}
			/>
			<ChipModalReviewRow
				label="Outbound internet"
				value={values.networkBlockAll ? 'Blocked' : 'Allowed'}
			/>
			<ChipModalReviewRow
				label="CIDR allow list"
				value={allowList(values.networkAllowList)}
			/>
			<ChipModalReviewRow
				label="Domain allow list"
				value={allowList(values.domainAllowList)}
			/>
			<ChipModalReviewRow
				label="Egress bandwidth"
				value={optionalLabel(
					values.egressBandwidthBps,
					(bandwidth) => `${formatCount(Number(bandwidth))} bps`,
					'Organization default'
				)}
			/>
		</ChipModalReviewSection>
		<ChipModalReviewSection title="Environment and storage">
			<ChipModalReviewRow
				label="Environment variables"
				value={lineCount(values.environment)}
			/>
			<ChipModalReviewRow
				label="Secret variables"
				value={lineCount(values.secretBindings)}
			/>
			<ChipModalReviewRow
				label="Volumes"
				value={lineCount(values.volumeMounts)}
			/>
			<ChipModalReviewRow label="Labels" value={lineCount(values.labels)} />
		</ChipModalReviewSection>
	</div>
	{#if placementError}
		<SandboxPlacementErrorNotice error={placementError} {onUseMachine} />
	{/if}
	<SandboxQuoteSummary {quote} />
</div>
