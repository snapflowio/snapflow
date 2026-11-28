<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const NOT_FOUND_STATUS = 404;
const APPEAL_RECEIVED_DESCRIPTION =
	'A person reviews every appeal. We email the organization owners when there is a decision.';
const NOT_APPEALABLE_DESCRIPTION =
	'If you think this is wrong, contact support.';
const NO_PERMISSION_DESCRIPTION =
	'Appeals need permission to manage sandboxes. Ask an organization owner to send it.';
const CASE_DESCRIPTION = 'What was reported and what Snapflow did about it.';
const APPEAL_DESCRIPTION =
	'Explain what the sandbox does and why the report or detection is wrong. Do not include passwords or other secrets.';
</script>

<script lang="ts">
import CircleCheck from '@lucide/svelte/icons/circle-check';
import Info from '@lucide/svelte/icons/info';
import ShieldQuestion from '@lucide/svelte/icons/shield-question';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import type { AbuseAppeal } from '@snapflow/api-client';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import PageSection from '#lib/components/detail/page-section.svelte';
import StatusBlock from '#lib/components/detail/status-block.svelte';
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import UnsavedChangesGuard from '#lib/components/settings/unsaved-changes-guard.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import { SUPPORT_HREF } from '#lib/config/support.ts';
import AbuseAppealTextField from '#lib/features/abuse/components/abuse-appeal-text-field.svelte';
import AbuseCaseSummary from '#lib/features/abuse/components/abuse-case-summary.svelte';
import CounterNoticeFields from '#lib/features/abuse/components/counter-notice-fields.svelte';
import { AbuseAppealForm } from '#lib/features/abuse/state/abuse-appeal-form.svelte.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';
import { formatDateTime } from '#lib/utils/format.ts';

interface AbuseAppealViewProps {
	caseId: string;
}

let { caseId }: AbuseAppealViewProps = $props();

const appeal = new AbuseAppealForm(() => caseId);
const notFound = $derived(
	appeal.query.error instanceof SnapflowError &&
		appeal.query.error.status === NOT_FOUND_STATUS
);
</script>

{#snippet contactSupport()}
	<Chip variant="secondary" size="compact" href={SUPPORT_HREF}>
		Contact support
	</Chip>
{/snippet}

{#snippet appealStatus(detail: AbuseAppeal)}
	{#if detail.appealedAt}
		<StatusBlock
			icon={CircleCheck}
			tone="success"
			title={`Appeal received on ${formatDateTime(detail.appealedAt)}`}
			description={APPEAL_RECEIVED_DESCRIPTION}
		/>
	{:else if !detail.appealable}
		<StatusBlock
			icon={Info}
			title={detail.resolvedAt
				? 'This case is resolved'
				: 'This decision cannot be appealed here'}
			description={NOT_APPEALABLE_DESCRIPTION}
			actions={contactSupport}
		/>
	{:else if !appeal.canWrite}
		<StatusBlock
			icon={TriangleAlert}
			tone="warning"
			title="You can't send this appeal"
			description={NO_PERMISSION_DESCRIPTION}
		/>
	{/if}
{/snippet}

<PageColumn
	width="narrow"
	title={appeal.counterNoticeRequired ? 'Counter-notice' : 'Appeal'}
	info="Tell us why an action taken against one of your sandboxes was a mistake. A person reviews every appeal."
	back={{ label: 'Sandboxes', href: resolvePath(Path.SANDBOXES) }}
	actions={appeal.actions}
	class="gap-y-12"
>
	{#if appeal.query.data}
		{const detail = $derived(appeal.query.data)}
		<PageSection title="Case" info={CASE_DESCRIPTION}>
			{@render appealStatus(detail)}
			<AbuseCaseSummary appeal={detail} />
		</PageSection>
		{#if appeal.open && !detail.appealedAt}
			<form
				novalidate
				class="flex flex-col gap-y-12"
				onsubmit={formSubmitHandler(appeal.form)}
			>
				<PageSection title="Your appeal" description={APPEAL_DESCRIPTION}>
					<AbuseAppealTextField
						{appeal}
						name="appeal"
						label="Why should this decision be reversed?"
						multiline
					/>
				</PageSection>
				{#if appeal.counterNoticeRequired}
					<CounterNoticeFields {appeal} />
				{/if}
			</form>
		{/if}
	{:else if notFound}
		<EmptyState icon={ShieldQuestion} title="This case doesn't exist">
			{#snippet actions()}
				<Chip variant="secondary" href={resolvePath(Path.SANDBOXES)}>
					Back to sandboxes
				</Chip>
			{/snippet}
		</EmptyState>
	{:else if appeal.query.isError}
		<FeedbackState
			class="flex-1"
			tone="error"
			resource="this case"
			error={appeal.query.error}
			retrying={appeal.query.isFetching}
			onRetry={() => void appeal.query.refetch()}
		/>
	{:else}
		<Skeleton class="h-40 rounded-2xl" />
		<Skeleton class="h-10" repeat={SKELETON_SECTION_ROWS} fade />
	{/if}
</PageColumn>
<UnsavedChangesGuard dirty={appeal.dirty} onDiscard={appeal.discard} />
