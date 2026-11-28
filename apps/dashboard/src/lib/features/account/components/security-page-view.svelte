<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import PasskeySettings from '#lib/features/account/components/passkey-settings.svelte';
import SessionSettings from '#lib/features/account/components/session-settings.svelte';
import TwoFactorSettings from '#lib/features/account/components/two-factor/two-factor-settings.svelte';
</script>

<SettingsPage title="Security">
	<PasskeySettings />
	<TwoFactorSettings />
	<SessionSettings />
</SettingsPage>
