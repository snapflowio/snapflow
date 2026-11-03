/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createContext } from 'svelte';
import { isEditableTarget, isModKey } from '#lib/utils/keyboard.ts';

const OWNED_SHORTCUTS_ATTRIBUTE = 'data-owned-shortcuts';
const OWNED_SHORTCUTS_SEPARATOR = ' ';

export interface GlobalCommand {
	id: string;
	label: string;
	key: string;
	mod: boolean;
	shift?: boolean;
	allowInEditable: boolean;
	run: () => void;
}

function shortcutId(command: Pick<GlobalCommand, 'key' | 'mod' | 'shift'>) {
	return [
		command.mod ? 'mod' : '',
		command.shift ? 'shift' : '',
		command.key.toLowerCase(),
	]
		.filter(Boolean)
		.join('+');
}

function isOwnedByFocus(target: EventTarget | null, id: string): boolean {
	if (!(target instanceof Element)) return false;
	const owner = target.closest(`[${OWNED_SHORTCUTS_ATTRIBUTE}]`);
	return Boolean(
		owner
			?.getAttribute(OWNED_SHORTCUTS_ATTRIBUTE)
			?.split(OWNED_SHORTCUTS_SEPARATOR)
			.includes(id)
	);
}

function matches(command: GlobalCommand, event: KeyboardEvent): boolean {
	return (
		event.key.toLowerCase() === command.key.toLowerCase() &&
		isModKey(event) === command.mod &&
		event.shiftKey === Boolean(command.shift) &&
		!event.altKey
	);
}

export class GlobalCommands {
	paletteOpen = $state(false);
	#commands: GlobalCommand[] = [];

	register = (command: GlobalCommand): (() => void) => {
		this.#commands = [...this.#commands, command];
		return () => {
			this.#commands = this.#commands.filter((entry) => entry !== command);
		};
	};

	togglePalette = (): void => {
		this.paletteOpen = !this.paletteOpen;
	};

	handleKeydown = (event: KeyboardEvent): void => {
		if (event.isComposing || event.defaultPrevented) return;
		const editable = isEditableTarget(event.target);
		const command = this.#commands.find((entry) => matches(entry, event));
		if (!command) return;
		if (editable && !command.allowInEditable) return;
		if (isOwnedByFocus(event.target, shortcutId(command))) return;
		event.preventDefault();
		command.run();
	};
}

export const [getGlobalCommands, setGlobalCommands] =
	createContext<GlobalCommands>();
