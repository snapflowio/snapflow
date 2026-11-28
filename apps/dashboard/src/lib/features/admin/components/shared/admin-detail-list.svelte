<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';

interface AdminDetailListProps {
	label?: string;
	children: Snippet;
}

let { label, children }: AdminDetailListProps = $props();
</script>

<KeyValueList {label}> {@render children()} </KeyValueList>
