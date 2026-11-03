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
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/go-vgo/robotgo"
	"github.com/snapflowio/computer-use/plugin"
)

type typingActionType int

const (
	typingActionText typingActionType = iota
	typingActionEnter
)

type typingAction struct {
	kind typingActionType
	text string
}

func (u *ComputerUse) TypeText(req *plugin.KeyboardTypeRequest) (*plugin.Empty, error) {
	actions, err := buildTypingActions(req.Text)
	if err != nil {
		return nil, err
	}

	for _, action := range actions {
		switch action.kind {
		case typingActionText:
			if req.Delay > 0 {
				robotgo.TypeStr(action.text, 0, req.Delay)
			} else {
				robotgo.TypeStr(action.text)
			}
		case typingActionEnter:
			if err := robotgo.KeyTap("enter"); err != nil {
				return nil, err
			}
			if req.Delay > 0 {
				time.Sleep(time.Duration(req.Delay) * time.Millisecond)
			}
		}
	}

	return new(plugin.Empty), nil
}

func buildTypingActions(text string) ([]typingAction, error) {
	text = strings.ReplaceAll(text, "\r\n", "\n")

	actions := make([]typingAction, 0)
	var currentText strings.Builder

	flushText := func() {
		if currentText.Len() == 0 {
			return
		}
		actions = append(actions, typingAction{
			kind: typingActionText,
			text: currentText.String(),
		})
		currentText.Reset()
	}

	for _, r := range text {
		switch r {
		case '\n', '\r':
			flushText()
			actions = append(actions, typingAction{kind: typingActionEnter})
		case '\t':
			return nil, fmt.Errorf(
				"keyboard.type does not translate '\\t' to Tab; use keyboard.press(\"tab\") for Tab key events",
			)
		case '\u2028', '\u2029':
			return nil, fmt.Errorf("unsupported separator character in keyboard.type: U+%04X", r)
		default:
			if unicode.IsControl(r) {
				return nil, fmt.Errorf("unsupported control character in keyboard.type: U+%04X", r)
			}
			currentText.WriteRune(r)
		}
	}

	flushText()
	return actions, nil
}

func (u *ComputerUse) PressKey(req *plugin.KeyboardPressRequest) (*plugin.Empty, error) {
	chord, err := normalizeKeyboardPress(req.Key, req.Modifiers)
	if err != nil {
		return nil, err
	}

	if len(chord.modifiers) > 0 {
		err = robotgo.KeyTap(chord.key, chord.modifiers)
	} else {
		err = robotgo.KeyTap(chord.key)
	}
	if err != nil {
		return nil, err
	}

	return new(plugin.Empty), nil
}

func (u *ComputerUse) PressHotkey(req *plugin.KeyboardHotkeyRequest) (*plugin.Empty, error) {
	chord, err := normalizeKeyboardHotkey(req.Keys)
	if err != nil {
		return nil, err
	}

	if len(chord.modifiers) > 0 {
		err = robotgo.KeyTap(chord.key, chord.modifiers)
	} else {
		err = robotgo.KeyTap(chord.key)
	}
	if err != nil {
		return nil, err
	}

	return new(plugin.Empty), nil
}
