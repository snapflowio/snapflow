/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Element, ElementContent, Root, RootContent } from 'hast';
import type { HighlighterCore, LanguageInput } from 'shiki/core';

const THEME = 'one-dark-pro';
const LINE_BREAK = /\r\n?/g;
const NEWLINE = '\n';

const PLAIN_TEXT_LANGUAGE = 'text';

const CODE_LANGUAGES: ReadonlyMap<string, string> = new Map(
	Object.entries({
		bash: 'bash',
		c: 'c',
		cc: 'cpp',
		cjs: 'javascript',
		cpp: 'cpp',
		cs: 'csharp',
		css: 'css',
		cxx: 'cpp',
		go: 'go',
		h: 'c',
		htm: 'markup',
		html: 'markup',
		hpp: 'cpp',
		hxx: 'cpp',
		java: 'java',
		js: 'javascript',
		json: 'json',
		jsx: 'jsx',
		kt: 'kotlin',
		kts: 'kotlin',
		md: 'markdown',
		mjs: 'javascript',
		php: 'php',
		py: 'python',
		rb: 'ruby',
		rs: 'rust',
		sh: 'bash',
		sql: 'sql',
		swift: 'swift',
		toml: 'toml',
		ts: 'typescript',
		tsx: 'tsx',
		xml: 'markup',
		yaml: 'yaml',
		yml: 'yaml',
		zsh: 'bash',
	})
);

const EXTENSIONLESS_CODE_LANGUAGES: ReadonlyMap<string, string> = new Map(
	Object.entries({
		dockerfile: 'docker',
		makefile: 'makefile',
	})
);

const SHIKI_LANGUAGES = {
	'actionscript-3': () => import('@shikijs/langs/actionscript-3'),
	c: () => import('@shikijs/langs/c'),
	coffee: () => import('@shikijs/langs/coffee'),
	cpp: () => import('@shikijs/langs/cpp'),
	css: () => import('@shikijs/langs/css'),
	go: () => import('@shikijs/langs/go'),
	graphql: () => import('@shikijs/langs/graphql'),
	html: () => import('@shikijs/langs/html'),
	javascript: () => import('@shikijs/langs/javascript'),
	json: () => import('@shikijs/langs/json'),
	jsx: () => import('@shikijs/langs/jsx'),
	kotlin: () => import('@shikijs/langs/kotlin'),
	markdown: () => import('@shikijs/langs/markdown'),
	'objective-c': () => import('@shikijs/langs/objective-c'),
	python: () => import('@shikijs/langs/python'),
	regexp: () => import('@shikijs/langs/regexp'),
	rust: () => import('@shikijs/langs/rust'),
	sql: () => import('@shikijs/langs/sql'),
	swift: () => import('@shikijs/langs/swift'),
	tsx: () => import('@shikijs/langs/tsx'),
	typescript: () => import('@shikijs/langs/typescript'),
	xml: () => import('@shikijs/langs/xml'),
	yaml: () => import('@shikijs/langs/yaml'),
} satisfies Record<string, LanguageInput>;

type ShikiLanguage = keyof typeof SHIKI_LANGUAGES;

const PREVIEW_LANGUAGES: ReadonlyMap<string, ShikiLanguage> = new Map(
	Object.entries({
		actionscript: 'actionscript-3',
		atom: 'xml',
		c: 'c',
		coffee: 'coffee',
		coffeescript: 'coffee',
		cpp: 'cpp',
		css: 'css',
		flow: 'javascript',
		go: 'go',
		graphql: 'graphql',
		html: 'html',
		javascript: 'javascript',
		js: 'javascript',
		json: 'json',
		jsx: 'jsx',
		kotlin: 'kotlin',
		kt: 'kotlin',
		kts: 'kotlin',
		markdown: 'markdown',
		markup: 'html',
		mathml: 'xml',
		md: 'markdown',
		n4js: 'javascript',
		n4jsd: 'javascript',
		objc: 'objective-c',
		objectivec: 'objective-c',
		py: 'python',
		python: 'python',
		regex: 'regexp',
		rss: 'xml',
		rust: 'rust',
		sql: 'sql',
		ssml: 'xml',
		svg: 'xml',
		swift: 'swift',
		ts: 'typescript',
		tsx: 'tsx',
		typescript: 'typescript',
		webmanifest: 'json',
		xml: 'xml',
		yaml: 'yaml',
		yml: 'yaml',
	} satisfies Record<string, ShikiLanguage>)
);

export interface HighlightedCode {
	foreground: string | undefined;
	lines: ElementContent[][];
}

let highlighter: Promise<HighlighterCore> | undefined;

function loadHighlighter(): Promise<HighlighterCore> {
	highlighter ??= Promise.all([
		import('shiki/core'),
		import('shiki/engine/javascript'),
	])
		.then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
			createHighlighterCore({
				themes: [import('@shikijs/themes/one-dark-pro')],
				langs: [],
				engine: createJavaScriptRegexEngine(),
			})
		)
		.catch((error: unknown) => {
			highlighter = undefined;
			throw error;
		});
	return highlighter;
}

function resolveLanguage(
	language: string
): ShikiLanguage | typeof PLAIN_TEXT_LANGUAGE {
	return PREVIEW_LANGUAGES.get(language.toLowerCase()) ?? PLAIN_TEXT_LANGUAGE;
}

function normalizeLineBreaks(code: string): string {
	return code.replace(LINE_BREAK, NEWLINE);
}

function childElements(node: Root | Element): Element[] {
	const children: readonly RootContent[] = node.children;
	return children.filter((child): child is Element => child.type === 'element');
}

export function plainCode(code: string): HighlightedCode {
	return {
		foreground: undefined,
		lines: normalizeLineBreaks(code)
			.split(NEWLINE)
			.map((line) => (line ? [{ type: 'text', value: line }] : [])),
	};
}

async function shikiCode(
	code: string,
	language: string
): Promise<HighlightedCode> {
	const lang = resolveLanguage(language);
	const instance = await loadHighlighter();
	if (
		lang !== PLAIN_TEXT_LANGUAGE &&
		!instance.getLoadedLanguages().includes(lang)
	) {
		await instance.loadLanguage(SHIKI_LANGUAGES[lang]);
	}
	const root = instance.codeToHast(normalizeLineBreaks(code), {
		lang,
		theme: THEME,
	});
	return {
		foreground: instance.getTheme(THEME).fg,
		lines: childElements(root)
			.flatMap(childElements)
			.flatMap(childElements)
			.map((line) => line.children),
	};
}

export function highlightCode(
	code: string,
	language: string
): Promise<HighlightedCode> {
	return shikiCode(code, language).catch(() => plainCode(code));
}

export function getCodeLanguage(path: string): string | null {
	const filename = path.split('/').at(-1)?.toLowerCase() ?? '';
	const extensionless = EXTENSIONLESS_CODE_LANGUAGES.get(filename);
	if (extensionless) return extensionless;
	const extension = filename.includes('.') ? filename.split('.').at(-1) : null;
	return extension ? (CODE_LANGUAGES.get(extension) ?? null) : null;
}
