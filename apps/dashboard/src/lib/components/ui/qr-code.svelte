<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { toCanvas } from 'qrcode';
import type { Attachment } from 'svelte/attachments';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';

const DEFAULT_SIZE_PX = 160;
const ERROR_CORRECTION = 'M';
const QUIET_ZONE_MODULES = 0;

function qrCode(value: string, size: number): Attachment<HTMLCanvasElement> {
	return (canvas) => {
		toCanvas(canvas, value, {
			width: size,
			margin: QUIET_ZONE_MODULES,
			errorCorrectionLevel: ERROR_CORRECTION,
		}).catch(() => toast.error('Could not render the QR code'));
	};
}

interface QrCodeProps {
	value: string;
	label: string;
	size?: number;
}
</script>

<script lang="ts">
let { value, label, size = DEFAULT_SIZE_PX }: QrCodeProps = $props();
</script>

<div class="w-fit rounded-lg bg-white p-3" role="img" aria-label={label}>
	<canvas aria-hidden="true" {@attach qrCode(value, size)}></canvas>
</div>
