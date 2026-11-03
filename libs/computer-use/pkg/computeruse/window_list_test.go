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
	"encoding/binary"
	"fmt"
	"slices"
	"testing"

	"github.com/jezek/xgb/xproto"
	"github.com/snapflowio/computer-use/plugin"
)

func windowListReply(windows ...xproto.Window) *xproto.GetPropertyReply {
	value := make([]byte, 0, len(windows)*windowIDBytes)
	for _, window := range windows {
		value = binary.LittleEndian.AppendUint32(value, uint32(window))
	}
	return &xproto.GetPropertyReply{
		Format:   windowPropertyFormat32,
		Type:     xproto.AtomWindow,
		ValueLen: uint32(len(windows)),
		Value:    value,
	}
}

func TestDecodeWindowListReturnsWindowIDs(t *testing.T) {
	want := []xproto.Window{0x1a00003, 0x2200007}

	windows, err := decodeWindowList(windowListReply(want...))
	if err != nil {
		t.Fatalf("decodeWindowList() error = %v", err)
	}
	if !slices.Equal(windows, want) {
		t.Fatalf("decodeWindowList() = %v, want %v", windows, want)
	}
}

func TestDecodeWindowListTreatsUnsetPropertyAsEmpty(t *testing.T) {
	windows, err := decodeWindowList(&xproto.GetPropertyReply{Type: xproto.AtomNone})
	if err != nil || len(windows) != 0 {
		t.Fatalf("decodeWindowList() = %v, %v, want an empty list", windows, err)
	}
}

func TestDecodeWindowListRejectsMalformedProperty(t *testing.T) {
	truncated := windowListReply(0x1a00003)
	truncated.ValueLen = 2
	tests := map[string]*xproto.GetPropertyReply{
		"wrong type":   {Type: xproto.AtomString, Format: windowPropertyFormat32},
		"wrong format": {Type: xproto.AtomWindow, Format: 8},
		"truncated":    truncated,
	}
	for name, reply := range tests {
		t.Run(name, func(t *testing.T) {
			if windows, err := decodeWindowList(reply); err == nil {
				t.Fatalf("decodeWindowList() = %v, want an error", windows)
			}
		})
	}
}

func TestWindowInfoUsesRootRelativeClientGeometry(t *testing.T) {
	geometry := &xproto.GetGeometryReply{X: 4, Y: 24, Width: 800, Height: 600}
	origin := &xproto.TranslateCoordinatesReply{DstX: 104, DstY: 74}

	info := windowInfo(0x1a00003, "Terminal", geometry, origin)

	want := plugin.WindowInfo{
		ID:       0x1a00003,
		Title:    "Terminal",
		Position: plugin.Position{X: 104, Y: 74},
		Size:     plugin.Size{Width: 800, Height: 600},
	}
	if info != want {
		t.Fatalf("windowInfo() = %+v, want %+v", info, want)
	}
}

func TestIsVanishedWindowMatchesWindowAndDrawableErrors(t *testing.T) {
	if !isVanishedWindow(fmt.Errorf("read title: %w", xproto.WindowError{})) {
		t.Fatal("a BadWindow error was not treated as a vanished window")
	}
	if !isVanishedWindow(fmt.Errorf("read geometry: %w", xproto.DrawableError{})) {
		t.Fatal("a BadDrawable error was not treated as a vanished window")
	}
	if isVanishedWindow(fmt.Errorf("read geometry: %w", xproto.AccessError{})) {
		t.Fatal("a BadAccess error was treated as a vanished window")
	}
	if isVanishedWindow(nil) {
		t.Fatal("a nil error was treated as a vanished window")
	}
}
