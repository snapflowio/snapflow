// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package computeruse

import (
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

const hotkeySeparator = "+"

type normalizedKey struct {
	token          string
	modifierFamily string
}

type normalizedChord struct {
	key       string
	modifiers []string
}

func normalizeKeyboardPress(key string, modifiers []string) (normalizedChord, error) {
	normalizedKey, err := normalizeKeyboardKey(key)
	if err != nil {
		return normalizedChord{}, err
	}

	normalizedModifiers, err := normalizeKeyboardModifiers(modifiers, pressContext(key, modifiers))
	if err != nil {
		return normalizedChord{}, err
	}

	if err := ensureNoModifierConflicts(normalizedKey, normalizedModifiers, pressContext(key, modifiers)); err != nil {
		return normalizedChord{}, err
	}

	return newChord(normalizedKey, normalizedModifiers), nil
}

func newChord(key normalizedKey, modifiers []string) normalizedChord {
	chord := normalizedChord{key: key.token}
	if len(modifiers) > 0 {
		chord.modifiers = modifiers
	}
	return chord
}

func normalizeKeyboardHotkey(raw string) (normalizedChord, error) {
	parts, err := splitHotkey(raw)
	if err != nil {
		return normalizedChord{}, fmt.Errorf("invalid hotkey %q: %w", raw, err)
	}
	key, err := normalizeKeyboardKey(parts[len(parts)-1])
	if err != nil {
		return normalizedChord{}, fmt.Errorf("invalid hotkey %q: %w", raw, err)
	}
	modifiers, err := hotkeyModifiers(parts[:len(parts)-1], hotkeyContext(raw))
	if err != nil {
		return normalizedChord{}, fmt.Errorf("invalid hotkey %q: %w", raw, err)
	}
	if err := ensureNoModifierConflicts(key, modifiers, hotkeyContext(raw)); err != nil {
		return normalizedChord{}, fmt.Errorf("invalid hotkey %q: %w", raw, err)
	}
	return newChord(key, modifiers), nil
}

func splitHotkey(raw string) ([]string, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, errors.New("empty key token")
	}
	parts := strings.Split(raw, hotkeySeparator)
	trimmedParts := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		switch {
		case trimmed == "" && part != "":
			return nil, errors.New("empty key token after trimming")
		case trimmed == "":
			return nil, errors.New("empty key token")
		case len(strings.Fields(trimmed)) > 1:
			return nil, errors.New("only a single chord is supported")
		}
		trimmedParts = append(trimmedParts, trimmed)
	}
	return trimmedParts, nil
}

func hotkeyModifiers(parts []string, context string) ([]string, error) {
	modifiers := make([]string, 0, len(parts))
	seenRaw := make(map[string]string, len(parts))
	for _, part := range parts {
		modifier, err := normalizeModifierToken(part)
		if err != nil {
			return nil, hotkeyModifierError(part)
		}
		if err := appendNormalizedModifier(&modifiers, seenRaw, modifier, part, context); err != nil {
			return nil, err
		}
	}
	return modifiers, nil
}

func hotkeyModifierError(part string) error {
	asKey, err := normalizeKeyboardKey(part)
	switch {
	case err != nil:
		return unsupportedModifierError(part)
	case asKey.modifierFamily != "":
		return fmt.Errorf(
			`unsupported modifier %q; supported modifiers: %s; left/right-specific modifier keys are only supported as the main key`,
			part,
			strings.Join(supportedModifierNames(), ", "),
		)
	default:
		return errors.New("chords may contain at most one non-modifier key")
	}
}

func normalizeKeyboardModifiers(raw []string, context string) ([]string, error) {
	modifiers := make([]string, 0, len(raw))
	seenRaw := make(map[string]string, len(raw))
	for _, modifier := range raw {
		normalized, err := normalizeModifierToken(modifier)
		if err != nil {
			return nil, err
		}
		if err := appendNormalizedModifier(&modifiers, seenRaw, normalized, modifier, context); err != nil {
			return nil, err
		}
	}
	return modifiers, nil
}

func appendNormalizedModifier(modifiers *[]string, seenRaw map[string]string, normalized, raw, context string) error {
	if previous, exists := seenRaw[normalized]; exists {
		if normalizeNamedToken(previous) == normalizeNamedToken(raw) {
			return fmt.Errorf(`duplicate modifier %q in %s`, normalized, context)
		}
		return fmt.Errorf(`duplicate modifier usage after normalization in %s`, context)
	}

	seenRaw[normalized] = raw
	*modifiers = append(*modifiers, normalized)
	return nil
}

func ensureNoModifierConflicts(key normalizedKey, modifiers []string, context string) error {
	if key.modifierFamily == "" {
		return nil
	}
	if slices.Contains(modifiers, key.modifierFamily) {
		return fmt.Errorf(`duplicate modifier usage after normalization in %s`, context)
	}
	return nil
}

func normalizeKeyboardKey(raw string) (normalizedKey, error) {
	if raw == "" {
		return normalizedKey{}, unsupportedKeyEmptyError(raw)
	}

	if canonical, blocked := disallowedNumpadShorthand()[strings.ToLower(raw)]; blocked {
		return normalizedKey{}, fmt.Errorf(`unsupported key %q; use %q`, raw, canonical)
	}

	if utf8.RuneCountInString(raw) == 1 {
		decodedRune, runeSize := utf8.DecodeRuneInString(raw)
		if decodedRune == utf8.RuneError && runeSize == 1 {
			return normalizedKey{}, fmt.Errorf("keyboard key is not valid UTF-8")
		}
		return normalizeSingleKeyRune(raw, decodedRune)
	}

	if strings.IndexFunc(raw, unicode.IsControl) >= 0 {
		return normalizedKey{}, unsupportedControlKeyError(raw)
	}
	if strings.IndexFunc(raw, unicode.IsSpace) >= 0 {
		return normalizedKey{}, unsupportedWhitespaceKeyError(raw)
	}
	if !isASCIIString(raw) {
		return normalizedKey{}, unsupportedUnicodeKeyError(raw)
	}

	normalizedName := normalizeNamedToken(raw)
	if alias, ok := mainKeyAliasMap()[normalizedName]; ok {
		normalizedName = alias
	}

	key, ok := keyExecutionMap()[normalizedName]
	if !ok {
		return normalizedKey{}, fmt.Errorf(
			`unsupported key %q; see supported keyboard key names in the computer-use docs`,
			raw,
		)
	}

	return key, nil
}

func normalizeSingleKeyRune(raw string, r rune) (normalizedKey, error) {
	switch {
	case unicode.IsSpace(r):
		return normalizedKey{}, unsupportedWhitespaceKeyError(raw)
	case unicode.IsControl(r):
		return normalizedKey{}, unsupportedControlKeyError(raw)
	case r > unicode.MaxASCII:
		return normalizedKey{}, unsupportedUnicodeKeyError(raw)
	case unicode.IsLetter(r):
		return normalizedKey{token: strings.ToLower(raw)}, nil
	case unicode.IsDigit(r):
		return normalizedKey{token: raw}, nil
	}

	if _, ok := allowedPunctuationKeys()[r]; ok {
		return normalizedKey{token: raw}, nil
	}
	if shiftedBase, ok := shiftedSymbolMap()[r]; ok {
		return normalizedKey{}, fmt.Errorf(
			`unsupported key %q; use press(%q, ["shift"]) for a shifted key or type(%q) for text`,
			raw,
			shiftedBase,
			raw,
		)
	}

	return normalizedKey{}, fmt.Errorf(`unsupported key %q; see supported keyboard key names in the computer-use docs`, raw)
}

func normalizeModifierToken(raw string) (string, error) {
	if raw == "" {
		return "", fmt.Errorf(`unsupported modifier %q; supported modifiers: %s`, raw, strings.Join(supportedModifierNames(), ", "))
	}
	if strings.IndexFunc(raw, unicode.IsControl) >= 0 || strings.IndexFunc(raw, unicode.IsSpace) >= 0 || !isASCIIString(raw) {
		return "", unsupportedModifierError(raw)
	}

	normalizedName := normalizeNamedToken(raw)
	if alias, ok := modifierAliasMap()[normalizedName]; ok {
		return alias, nil
	}
	if _, ok := keyExecutionMap()[normalizedName]; ok {
		return "", fmt.Errorf(
			`unsupported modifier %q; supported modifiers: %s; left/right-specific modifier keys are only supported as the main key`,
			raw,
			strings.Join(supportedModifierNames(), ", "),
		)
	}
	return "", unsupportedModifierError(raw)
}

func unsupportedModifierError(raw string) error {
	return fmt.Errorf(`unsupported modifier %q; supported modifiers: %s`, raw, strings.Join(supportedModifierNames(), ", "))
}

func unsupportedKeyEmptyError(raw string) error {
	return fmt.Errorf(`unsupported key %q: empty key token`, raw)
}

func unsupportedWhitespaceKeyError(raw string) error {
	switch raw {
	case " ":
		return fmt.Errorf(`unsupported key %q; use press("space") or type(" ")`, raw)
	case "\t":
		return fmt.Errorf(`unsupported key %q; use press("tab") or type("\t")`, raw)
	case "\n", "\r":
		return fmt.Errorf(`unsupported key %q; use press("enter") or type(%q)`, raw, raw)
	default:
		return fmt.Errorf(`unsupported key %q; use a named key such as "space", "tab", or "enter"`, raw)
	}
}

func unsupportedControlKeyError(raw string) error {
	if raw == "\t" || raw == "\n" || raw == "\r" {
		return unsupportedWhitespaceKeyError(raw)
	}
	return fmt.Errorf(`unsupported key %q; use type(%q) for text input`, raw, raw)
}

func unsupportedUnicodeKeyError(raw string) error {
	return fmt.Errorf(`unsupported key %q; use type(%q) for text input`, raw, raw)
}

func normalizeNamedToken(raw string) string {
	return strings.ReplaceAll(strings.ToLower(raw), "-", "_")
}

func isASCIIString(value string) bool {
	for _, r := range value {
		if r > unicode.MaxASCII {
			return false
		}
	}
	return true
}

func hotkeyContext(raw string) string {
	return fmt.Sprintf("hotkey(%q)", raw)
}

func pressContext(key string, modifiers []string) string {
	var builder strings.Builder
	builder.WriteString("press(")
	builder.WriteString(strconv.Quote(key))
	builder.WriteString(", [")
	for i, modifier := range modifiers {
		if i > 0 {
			builder.WriteString(", ")
		}
		builder.WriteString(strconv.Quote(modifier))
	}
	builder.WriteString("])")
	return builder.String()
}
