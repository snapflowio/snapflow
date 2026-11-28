<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import PageColumn from '#lib/components/page/page-column.svelte';
import MachineDiagnosticsSection from '#lib/features/machines/components/detail/machine-diagnostics-section.svelte';
import MachineLocalBenchmarkPanel from '#lib/features/machines/components/detail/machine-local-benchmark-panel.svelte';
import MachineLocalBenchmarkSection from '#lib/features/machines/components/detail/machine-local-benchmark-section.svelte';
import MachinePaymentHoldsSection from '#lib/features/machines/components/detail/machine-payment-holds-section.svelte';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';

const detail = getMachineDetail();
const machine = $derived(detail.machine);
let benchmarkOpen = $state(false);
</script>

<div class="relative flex min-h-0 flex-1 flex-col">
	<PageColumn class="gap-y-12">
		<MachineLocalBenchmarkSection
			benchmark={machine.localBenchmark}
			onOpen={() => (benchmarkOpen = true)}
		/>
		<MachineDiagnosticsSection diagnostics={machine.diagnostics} separated />
		{#if (machine.paymentHolds?.holds.length ?? 0) > 0}
			<MachinePaymentHoldsSection
				paymentHolds={machine.paymentHolds}
				separated
			/>
		{/if}
	</PageColumn>
	<MachineLocalBenchmarkPanel
		benchmark={machine.localBenchmark}
		open={benchmarkOpen}
		onClose={() => (benchmarkOpen = false)}
	/>
</div>
