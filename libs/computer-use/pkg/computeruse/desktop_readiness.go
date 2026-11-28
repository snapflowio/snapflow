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

	"github.com/jezek/xgb"
	"github.com/jezek/xgb/xproto"
)

const (
	netSupportingWMCheckAtom = "_NET_SUPPORTING_WM_CHECK"
	netWindowTypeAtom        = "_NET_WM_WINDOW_TYPE"
	netWindowTypeDesktopAtom = "_NET_WM_WINDOW_TYPE_DESKTOP"
)

var (
	errWindowManagerNotRunning = errors.New("the window manager is not managing the screen yet")
	errDesktopNotMapped        = errors.New("the desktop window is not managed yet")
)

func desktopSessionReady() error {
	connection, err := xgb.NewConn()
	if err != nil {
		return fmt.Errorf("connect to X display: %w", err)
	}
	defer connection.Close()

	atoms, err := internAtoms(connection, netSupportingWMCheckAtom, netClientListAtom, netWindowTypeAtom, netWindowTypeDesktopAtom)
	if err != nil {
		return err
	}
	root := xproto.Setup(connection).DefaultScreen(connection).Root
	check, err := readWindowProperty(connection, root, atoms[netSupportingWMCheckAtom])
	if err != nil {
		return fmt.Errorf("read window manager check: %w", err)
	}
	if len(check) == 0 {
		return errWindowManagerNotRunning
	}
	clients, err := readWindowProperty(connection, root, atoms[netClientListAtom])
	if err != nil {
		return fmt.Errorf("read managed window list: %w", err)
	}
	for _, window := range clients {
		types, err := readAtomProperty(connection, window, atoms[netWindowTypeAtom])
		if isVanishedWindow(err) {
			continue
		}
		if err != nil {
			return fmt.Errorf("read type of window %d: %w", window, err)
		}
		if slices.Contains(types, atoms[netWindowTypeDesktopAtom]) {
			return nil
		}
	}
	return errDesktopNotMapped
}

func internAtoms(connection *xgb.Conn, names ...string) (map[string]xproto.Atom, error) {
	cookies := make([]xproto.InternAtomCookie, len(names))
	for index, name := range names {
		cookies[index] = xproto.InternAtom(connection, false, uint16(len(name)), name)
	}
	atoms := make(map[string]xproto.Atom, len(names))
	for index, cookie := range cookies {
		reply, err := cookie.Reply()
		if err != nil {
			return nil, fmt.Errorf("intern X atom %s: %w", names[index], err)
		}
		atoms[names[index]] = reply.Atom
	}
	return atoms, nil
}

func readAtomProperty(connection *xgb.Conn, window xproto.Window, property xproto.Atom) ([]xproto.Atom, error) {
	reply, err := xproto.GetProperty(connection, false, window, property, xproto.AtomAtom, 0, windowPropertyMaxLength).Reply()
	if err != nil {
		return nil, err
	}
	if reply.Type == xproto.AtomNone {
		return nil, nil
	}
	if reply.Type != xproto.AtomAtom || reply.Format != windowPropertyFormat32 {
		return nil, fmt.Errorf("atom property has type %d and format %d, want ATOM with format %d", reply.Type, reply.Format, windowPropertyFormat32)
	}
	if len(reply.Value) < int(reply.ValueLen)*windowIDBytes {
		return nil, fmt.Errorf("atom property holds %d bytes, want %d", len(reply.Value), int(reply.ValueLen)*windowIDBytes)
	}
	atoms := make([]xproto.Atom, reply.ValueLen)
	for index := range atoms {
		atoms[index] = xproto.Atom(xgb.Get32(reply.Value[index*windowIDBytes:]))
	}
	return atoms, nil
}
