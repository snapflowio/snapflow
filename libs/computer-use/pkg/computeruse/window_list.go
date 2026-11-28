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

	"github.com/jezek/xgb"
	"github.com/jezek/xgb/xproto"
	"github.com/snapflowio/computer-use/plugin"
)

const (
	netClientListAtom       = "_NET_CLIENT_LIST"
	netActiveWindowAtom     = "_NET_ACTIVE_WINDOW"
	netWindowNameAtom       = "_NET_WM_NAME"
	utf8StringAtom          = "UTF8_STRING"
	windowPropertyMaxLength = 1 << 16
	windowPropertyFormat32  = 32
	windowIDBytes           = 4
)

type windowAtoms struct {
	clientList   xproto.Atom
	activeWindow xproto.Atom
	windowName   xproto.Atom
	utf8String   xproto.Atom
}

func (c *ComputerUse) GetWindows() (*plugin.WindowsResponse, error) {
	connection, err := xgb.NewConn()
	if err != nil {
		return nil, fmt.Errorf("connect to X display: %w", err)
	}
	defer connection.Close()

	root := xproto.Setup(connection).DefaultScreen(connection).Root
	atoms, err := internWindowAtoms(connection)
	if err != nil {
		return nil, err
	}
	clients, err := readWindowProperty(connection, root, atoms.clientList)
	if err != nil {
		return nil, fmt.Errorf("read managed window list: %w", err)
	}
	active, err := readWindowProperty(connection, root, atoms.activeWindow)
	if err != nil {
		return nil, fmt.Errorf("read active window: %w", err)
	}
	var activeWindow xproto.Window
	if len(active) > 0 {
		activeWindow = active[0]
	}

	windows := make([]plugin.WindowInfo, 0, len(clients))
	for _, window := range clients {
		info, err := describeWindow(connection, root, atoms, window)
		if isVanishedWindow(err) {
			continue
		}
		if err != nil {
			return nil, err
		}
		info.IsActive = window == activeWindow
		windows = append(windows, info)
	}
	return &plugin.WindowsResponse{Windows: windows}, nil
}

func internWindowAtoms(connection *xgb.Conn) (windowAtoms, error) {
	atoms, err := internAtoms(connection, netClientListAtom, netActiveWindowAtom, netWindowNameAtom, utf8StringAtom)
	if err != nil {
		return windowAtoms{}, err
	}
	return windowAtoms{
		clientList:   atoms[netClientListAtom],
		activeWindow: atoms[netActiveWindowAtom],
		windowName:   atoms[netWindowNameAtom],
		utf8String:   atoms[utf8StringAtom],
	}, nil
}

func describeWindow(connection *xgb.Conn, root xproto.Window, atoms windowAtoms, window xproto.Window) (plugin.WindowInfo, error) {
	title, err := readWindowTitle(connection, atoms, window)
	if err != nil {
		return plugin.WindowInfo{}, fmt.Errorf("read title of window %d: %w", window, err)
	}
	geometry, err := xproto.GetGeometry(connection, xproto.Drawable(window)).Reply()
	if err != nil {
		return plugin.WindowInfo{}, fmt.Errorf("read geometry of window %d: %w", window, err)
	}
	origin, err := xproto.TranslateCoordinates(connection, window, root, 0, 0).Reply()
	if err != nil {
		return plugin.WindowInfo{}, fmt.Errorf("translate position of window %d: %w", window, err)
	}
	return windowInfo(window, title, geometry, origin), nil
}

func windowInfo(window xproto.Window, title string, geometry *xproto.GetGeometryReply, origin *xproto.TranslateCoordinatesReply) plugin.WindowInfo {
	return plugin.WindowInfo{
		ID:       int(window),
		Title:    title,
		Position: plugin.Position{X: int(origin.DstX), Y: int(origin.DstY)},
		Size:     plugin.Size{Width: int(geometry.Width), Height: int(geometry.Height)},
	}
}

func readWindowTitle(connection *xgb.Conn, atoms windowAtoms, window xproto.Window) (string, error) {
	title, err := readStringProperty(connection, window, atoms.windowName, atoms.utf8String)
	if err != nil || title != "" {
		return title, err
	}
	return readStringProperty(connection, window, xproto.AtomWmName, xproto.GetPropertyTypeAny)
}

func readStringProperty(connection *xgb.Conn, window xproto.Window, property, propertyType xproto.Atom) (string, error) {
	reply, err := xproto.GetProperty(connection, false, window, property, propertyType, 0, windowPropertyMaxLength).Reply()
	if err != nil {
		return "", err
	}
	return string(reply.Value), nil
}

func readWindowProperty(connection *xgb.Conn, window xproto.Window, property xproto.Atom) ([]xproto.Window, error) {
	reply, err := xproto.GetProperty(connection, false, window, property, xproto.AtomWindow, 0, windowPropertyMaxLength).Reply()
	if err != nil {
		return nil, err
	}
	return decodeWindowList(reply)
}

func decodeWindowList(reply *xproto.GetPropertyReply) ([]xproto.Window, error) {
	if reply.Type == xproto.AtomNone {
		return nil, nil
	}
	if reply.Type != xproto.AtomWindow || reply.Format != windowPropertyFormat32 {
		return nil, fmt.Errorf("window property has type %d and format %d, want WINDOW with format %d", reply.Type, reply.Format, windowPropertyFormat32)
	}
	if len(reply.Value) < int(reply.ValueLen)*windowIDBytes {
		return nil, fmt.Errorf("window property holds %d bytes, want %d", len(reply.Value), int(reply.ValueLen)*windowIDBytes)
	}
	windows := make([]xproto.Window, reply.ValueLen)
	for index := range windows {
		windows[index] = xproto.Window(xgb.Get32(reply.Value[index*windowIDBytes:]))
	}
	return windows, nil
}

func isVanishedWindow(err error) bool {
	var windowErr xproto.WindowError
	var drawableErr xproto.DrawableError
	return errors.As(err, &windowErr) || errors.As(err, &drawableErr)
}
