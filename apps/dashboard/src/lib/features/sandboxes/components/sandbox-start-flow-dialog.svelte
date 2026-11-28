<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { SandboxStartFlow } from '#lib/features/sandboxes/state/sandbox-start-flow.svelte.ts';
import SandboxStartChoiceModal from './sandbox-start-choice-modal.svelte';

let { flow }: { flow: SandboxStartFlow } = $props();
</script>

<SandboxStartChoiceModal
	bind:open={() => flow.choiceOpen, flow.changeChoiceOpen}
	failure={flow.failure}
	onChoose={flow.choose}
	pending={flow.mutation.isPending}
/>
