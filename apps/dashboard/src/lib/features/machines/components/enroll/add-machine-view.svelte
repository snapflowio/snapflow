<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import KeyRound from '@lucide/svelte/icons/key-round';
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { WELL_FOOTER_LINK_CLASS } from '#lib/features/billing/lib/well-footer-link.ts';
import { MachineEnrollment } from '#lib/features/machines/state/machine-enrollment.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';
import EnrollmentStepper from './enrollment-stepper.svelte';
import ManageEnrollmentKeysModal from './manage-enrollment-keys-modal.svelte';

const enrollment = new MachineEnrollment();
const { docsHref } = getWebsiteLinks();
</script>

{#snippet footer()}
	{#if enrollment.canWrite}
		<Chip
			variant="ghost"
			size="compact"
			class={WELL_FOOTER_LINK_CLASS}
			leftIcon={KeyRound}
			onclick={() => (enrollment.managing = true)}
		>
			Manage enrollment keys
		</Chip>
	{/if}
	<Chip
		variant="ghost"
		size="compact"
		class={WELL_FOOTER_LINK_CLASS}
		rightIcon={ArrowUpRight}
		href={docsHref}
		target="_blank"
		rel="noopener noreferrer"
	>
		Hosting docs
	</Chip>
{/snippet}

<PageColumn back={{ label: 'Machines', href: resolve(Path.MACHINES) }}>
	<EnrollmentStepper
		{enrollment}
		title="Add a machine"
		description="Any Linux machine with KVM. The agent installs as a service, benchmarks the machine and lists it once approved."
		{footer}
	/>
</PageColumn>
<ManageEnrollmentKeysModal {enrollment} />
