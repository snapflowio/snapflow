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

func supportedModifierNames() []string {
	return []string{"ctrl", "alt", "shift", "cmd"}
}

func modifierAliasMap() map[string]string {
	return map[string]string{
		"alt":     "alt",
		"cmd":     "cmd",
		"command": "cmd",
		"control": "ctrl",
		"ctrl":    "ctrl",
		"meta":    "cmd",
		"option":  "alt",
		"shift":   "shift",
		"super":   "cmd",
		"win":     "cmd",
		"windows": "cmd",
	}
}

func mainKeyAliasMap() map[string]string {
	return map[string]string{
		"cmd":           "cmd",
		"command":       "cmd",
		"control":       "ctrl",
		"ctrl":          "ctrl",
		"del":           "delete",
		"esc":           "escape",
		"left_alt":      "lalt",
		"left_cmd":      "lcmd",
		"left_command":  "lcmd",
		"left_control":  "lctrl",
		"left_ctrl":     "lctrl",
		"left_shift":    "lshift",
		"meta":          "cmd",
		"option":        "alt",
		"page_down":     "pagedown",
		"page_up":       "pageup",
		"return":        "enter",
		"right_alt":     "ralt",
		"right_cmd":     "rcmd",
		"right_command": "rcmd",
		"right_control": "rctrl",
		"right_ctrl":    "rctrl",
		"right_shift":   "rshift",
		"spacebar":      "space",
		"super":         "cmd",
		"win":           "cmd",
		"windows":       "cmd",
	}
}

func keyExecutionMap() map[string]normalizedKey {
	return map[string]normalizedKey{
		"alt":          {token: "alt", modifierFamily: "alt"},
		"backspace":    {token: "backspace"},
		"capslock":     {token: "capslock"},
		"cmd":          {token: "cmd", modifierFamily: "cmd"},
		"ctrl":         {token: "ctrl", modifierFamily: "ctrl"},
		"delete":       {token: "delete"},
		"down":         {token: "down"},
		"end":          {token: "end"},
		"enter":        {token: "enter"},
		"escape":       {token: "escape"},
		"f1":           {token: "f1"},
		"f2":           {token: "f2"},
		"f3":           {token: "f3"},
		"f4":           {token: "f4"},
		"f5":           {token: "f5"},
		"f6":           {token: "f6"},
		"f7":           {token: "f7"},
		"f8":           {token: "f8"},
		"f9":           {token: "f9"},
		"f10":          {token: "f10"},
		"f11":          {token: "f11"},
		"f12":          {token: "f12"},
		"f13":          {token: "f13"},
		"f14":          {token: "f14"},
		"f15":          {token: "f15"},
		"f16":          {token: "f16"},
		"f17":          {token: "f17"},
		"f18":          {token: "f18"},
		"f19":          {token: "f19"},
		"f20":          {token: "f20"},
		"f21":          {token: "f21"},
		"f22":          {token: "f22"},
		"f23":          {token: "f23"},
		"f24":          {token: "f24"},
		"home":         {token: "home"},
		"insert":       {token: "insert"},
		"lalt":         {token: "lalt", modifierFamily: "alt"},
		"lcmd":         {token: "lcmd", modifierFamily: "cmd"},
		"lctrl":        {token: "lctrl", modifierFamily: "ctrl"},
		"left":         {token: "left"},
		"lshift":       {token: "lshift", modifierFamily: "shift"},
		"menu":         {token: "menu"},
		"num0":         {token: "num0"},
		"num1":         {token: "num1"},
		"num2":         {token: "num2"},
		"num3":         {token: "num3"},
		"num4":         {token: "num4"},
		"num5":         {token: "num5"},
		"num6":         {token: "num6"},
		"num7":         {token: "num7"},
		"num8":         {token: "num8"},
		"num9":         {token: "num9"},
		"num_asterisk": {token: "num*"},
		"num_decimal":  {token: "num."},
		"num_enter":    {token: "num_enter"},
		"num_equal":    {token: "num_equal"},
		"num_lock":     {token: "num_lock"},
		"num_minus":    {token: "num-"},
		"num_plus":     {token: "num+"},
		"num_slash":    {token: "num/"},
		"pagedown":     {token: "pagedown"},
		"pageup":       {token: "pageup"},
		"ralt":         {token: "ralt", modifierFamily: "alt"},
		"rcmd":         {token: "rcmd", modifierFamily: "cmd"},
		"rctrl":        {token: "rctrl", modifierFamily: "ctrl"},
		"right":        {token: "right"},
		"rshift":       {token: "rshift", modifierFamily: "shift"},
		"shift":        {token: "shift", modifierFamily: "shift"},
		"space":        {token: "space"},
		"tab":          {token: "tab"},
		"up":           {token: "up"},
	}
}

func shiftedSymbolMap() map[rune]string {
	return map[rune]string{
		'!': "1",
		'"': "'",
		'#': "3",
		'$': "4",
		'%': "5",
		'&': "7",
		'(': "9",
		')': "0",
		'*': "8",
		'+': "=",
		':': ";",
		'<': ",",
		'>': ".",
		'?': "/",
		'@': "2",
		'^': "6",
		'_': "-",
		'{': "[",
		'|': "\\",
		'}': "]",
		'~': "`",
	}
}

func allowedPunctuationKeys() map[rune]struct{} {
	return map[rune]struct{}{
		'\'': {},
		',':  {},
		'-':  {},
		'.':  {},
		'/':  {},
		';':  {},
		'=':  {},
		'[':  {},
		'\\': {},
		']':  {},
		'`':  {},
	}
}

func disallowedNumpadShorthand() map[string]string {
	return map[string]string{
		"num*": "num_asterisk",
		"num+": "num_plus",
		"num-": "num_minus",
		"num.": "num_decimal",
		"num/": "num_slash",
	}
}
