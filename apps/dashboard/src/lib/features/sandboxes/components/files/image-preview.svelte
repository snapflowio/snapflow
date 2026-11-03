<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
interface ImagePreviewProps {
	blob: Blob;
	name: string;
}

let { blob, name }: ImagePreviewProps = $props();

function showBlob(image: HTMLImageElement): () => void {
	const url = URL.createObjectURL(blob);
	image.src = url;
	return () => URL.revokeObjectURL(url);
}
</script>

<div
	class="flex h-full items-center justify-center overflow-hidden bg-[repeating-conic-gradient(var(--surface-2)_0_25%,var(--surface-1)_0_50%)_50%/16px_16px] p-6"
>
	<img
		{@attach showBlob}
		alt={name}
		class="max-h-full max-w-full object-contain"
	>
</div>
