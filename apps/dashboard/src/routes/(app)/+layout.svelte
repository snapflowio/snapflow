<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { adminMfaStepUp } from '#lib/api/admin/mfa-step-up.svelte.ts';
import { reauthentication } from '#lib/api/auth/reauthentication.svelte.ts';
import AdminMfaStepUpModal from '#lib/features/admin/components/admin-mfa-step-up-modal.svelte';
import ReauthenticationModal from '#lib/features/auth/components/reauthentication-modal.svelte';
import { AuthState, setAuth } from '#lib/features/auth/state/auth.svelte.ts';
import type { LayoutProps } from './$types';

let { children }: LayoutProps = $props();

setAuth(new AuthState());
</script>

{@render children()}
{#if adminMfaStepUp.open}
	<AdminMfaStepUpModal />
{/if}
{#if reauthentication.requested}
	<ReauthenticationModal />
{/if}
