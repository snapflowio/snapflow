/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { LucideProps } from '@lucide/svelte';
import type { Component } from 'svelte';
import type { SVGAttributes } from 'svelte/elements';

export const ICON_STROKE_WIDTH = 1.55;

export type IconProps = SVGAttributes<SVGSVGElement>;

export type IconComponent = Component<LucideProps>;
