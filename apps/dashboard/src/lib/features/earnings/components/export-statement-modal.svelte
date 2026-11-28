<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const PREVIOUS_MONTH = -1;
const NEXT_MONTH = 1;
</script>

<script lang="ts">
import ChevronLeft from '@lucide/svelte/icons/chevron-left';
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import Download from '@lucide/svelte/icons/download';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import { fetchAllHostPayouts } from '#lib/api/settlement/host-payouts.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import {
	compareStatementMonths,
	currentStatementMonth,
	type StatementMonth,
	shiftStatementMonth,
	statementCsv,
	statementFilename,
	statementMonthLabel,
	statementMonthRange,
} from '#lib/features/earnings/lib/statement.ts';
import { Path } from '#lib/routing/paths.ts';
import { downloadFile } from '#lib/utils/download-file.ts';
import { resolve } from '$app/paths';

interface ExportStatementModalProps {
	open: boolean;
	onClose: () => void;
}

let { open, onClose }: ExportStatementModalProps = $props();

const latest = currentStatementMonth(new Date());
let month = $state<StatementMonth>(latest);
let downloading = $state(false);
let errorMessage = $state<string | null>(null);
const atLatest = $derived(compareStatementMonths(month, latest) >= 0);

function step(offset: number): void {
	errorMessage = null;
	month = shiftStatementMonth(month, offset);
}

function close(): void {
	if (downloading) return;
	errorMessage = null;
	onClose();
}

async function download(): Promise<void> {
	if (downloading) return;
	downloading = true;
	errorMessage = null;
	try {
		const payouts = await fetchAllHostPayouts(statementMonthRange(month));
		downloadFile(statementCsv(payouts), statementFilename(month));
		onClose();
	} catch (error) {
		errorMessage = userErrorMessage(error);
	} finally {
		downloading = false;
	}
}
</script>

<ChipModal
	{open}
	onOpenChange={(next) => {
		if (!next) close();
	}}
	onsubmit={() => void download()}
	dismissDisabled={downloading}
	size="sm"
	srTitle="Export statement"
>
	<ChipModalHeader onClose={close}> Export statement </ChipModalHeader>
	<ChipModalBody>
		<ChipModalError message={errorMessage} />
		<div class="flex items-center justify-between gap-3">
			<span class="text-(--text-primary) text-sm">Month</span>
			<div class="flex items-center">
				<Chip
					variant="secondary"
					size="compact"
					class="rounded-r-none border-r-0"
					aria-label="Previous month"
					leftIcon={ChevronLeft}
					onclick={() => step(PREVIOUS_MONTH)}
				/>
				<span
					class="flex h-8 min-w-24 items-center justify-center border-border border-y bg-surface-1 px-3 font-mono text-(--text-primary) text-sm tabular-nums"
					aria-live="polite"
				>
					{statementMonthLabel(month)}
				</span>
				<Chip
					variant="secondary"
					size="compact"
					class="rounded-l-none border-l-0"
					aria-label="Next month"
					leftIcon={ChevronRight}
					disabled={atLatest}
					onclick={() => step(NEXT_MONTH)}
				/>
			</div>
		</div>
		<p class="text-(--text-muted) text-sm">
			Statements use the name on your
			<a
				class="text-(--text-secondary) underline underline-offset-4 hover-hover:text-(--text-primary)"
				href={resolve(Path.HOST_PROFILE)}
				>host profile</a
			>.
		</p>
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={downloading}>
		{#snippet primaryAction(initialFocus)}
			<Chip
				type="submit"
				variant="primary"
				leftIcon={Download}
				loading={downloading}
				{@attach initialFocus}
			>
				Download CSV
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
