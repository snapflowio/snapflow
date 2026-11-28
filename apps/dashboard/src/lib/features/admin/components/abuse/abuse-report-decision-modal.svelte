<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { AbuseReportStatus } from '@snapflow/api-client';
import type { AbuseReportDecisionInput } from '#lib/api/admin/abuse-reports.ts';
import {
	ABUSE_REPORT_DECISION_DESCRIPTION,
	ABUSE_REPORT_DECISION_LABEL,
	ABUSE_REPORT_DECISIONS,
} from '#lib/features/admin/lib/abuse-reports-list.ts';

type Decision = AbuseReportDecisionInput['body']['decision'];

const DECISION_TABS = ABUSE_REPORT_DECISIONS.map((decision) => ({
	label: ABUSE_REPORT_DECISION_LABEL[decision],
	value: decision,
}));
const DECISION_VALUES: ReadonlySet<string> = new Set(ABUSE_REPORT_DECISIONS);

function isDecision(value: string): value is Decision {
	return DECISION_VALUES.has(value);
}

interface AbuseReportDecisionModalProps {
	open: boolean;
	pending: boolean;
	onDecide: (body: AbuseReportDecisionInput['body']) => void;
	onClose: () => void;
}
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipTextarea from '#lib/components/ui/chip/chip-textarea.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import ChipModalTabs from '#lib/components/ui/chip-modal/chip-modal-tabs.svelte';

let { open, pending, onDecide, onClose }: AbuseReportDecisionModalProps =
	$props();

const noteId = $props.id();
let decision = $derived.by<Decision>(() => {
	void open;
	return AbuseReportStatus.Actioned;
});
let note = $derived.by(() => {
	void open;
	return '';
});

function submit() {
	if (pending) return;
	onDecide({ decision, note: note.trim() || undefined });
}

function setOpen(next: boolean) {
	if (!next) onClose();
}
</script>

<ChipModal
	bind:open={() => open, setOpen}
	onsubmit={submit}
	srTitle="Record decision"
	dismissDisabled={pending}
>
	<ChipModalHeader {onClose} closeDisabled={pending}>
		Record decision
	</ChipModalHeader>
	<ChipModalBody>
		<div class="flex flex-col gap-2">
			<ChipModalTabs
				aria-label="Decision"
				tabs={DECISION_TABS}
				value={decision}
				onChange={(value) => {
					if (isDecision(value)) decision = value;
				}}
			/>
			<p class="text-(--text-muted) text-sm">
				{ABUSE_REPORT_DECISION_DESCRIPTION[decision]}
			</p>
		</div>
		<ChipModalField label="Note" for={noteId}>
			<ChipTextarea
				id={noteId}
				placeholder="Shared with the reporter and recorded in the audit log"
				bind:value={note}
			/>
		</ChipModalField>
	</ChipModalBody>
	<ChipModalFooter onCancel={onClose} cancelDisabled={pending}>
		{#snippet primaryAction()}
			<Chip
				loading={pending}
				type="submit"
				variant="primary"
				disabled={pending}
			>
				Record decision
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
