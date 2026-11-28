<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import AuthLayout from '#lib/features/auth/components/layout/auth-layout.svelte';
import SignupPasskeyPanel from '#lib/features/auth/components/signup/signup-passkey-panel.svelte';
import type { PageProps } from './$types';

let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Create your passkey · Snapflow</title>
</svelte:head>

<AuthLayout>
	<SignupPasskeyPanel returnTo={data.returnTo} />
</AuthLayout>
