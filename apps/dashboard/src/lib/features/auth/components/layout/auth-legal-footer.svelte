<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import AuthTextLink from '#lib/features/auth/components/sign-in/auth-text-link.svelte';

interface AuthLegalFooterProps {
	action: string;
}

let { action }: AuthLegalFooterProps = $props();

const { privacyHref, termsHref } = getWebsiteLinks();
</script>

<p class="text-center text-(--text-muted) text-caption leading-relaxed">
	By {action}, you agree to our
	<AuthTextLink href={termsHref} external>Terms of Service</AuthTextLink>
	and
	<AuthTextLink href={privacyHref} external>Privacy Policy</AuthTextLink>
</p>
