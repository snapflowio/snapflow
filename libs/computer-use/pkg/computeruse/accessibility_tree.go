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

	"github.com/godbus/dbus/v5"
)

func (c *ComputerUse) resolveScopeRoot(conn *dbus.Conn, scope A11yScope, pid int) (accessibleRef, error) {
	switch scope {
	case A11yScopeAll, "":
		return accessibleRef{Sender: atspiRegistryBus, Path: atspiRootPath}, nil
	case A11yScopeFocused:
		return c.getFocusedAppRoot(conn)
	case A11yScopePID:
		return c.getAppRootByPID(conn, pid)
	default:
		return accessibleRef{}, fmt.Errorf("%w: unknown scope %q", ErrInvalidScope, scope)
	}
}

func (c *ComputerUse) getFocusedAppRoot(conn *dbus.Conn) (accessibleRef, error) {
	apps, err := getChildren(conn, atspiRegistryBus, atspiRootPath)
	if err != nil {
		return accessibleRef{}, err
	}
	if len(apps) == 0 {
		return accessibleRef{}, ErrNoAccessibleRoot
	}
	for _, app := range apps {
		if appHasActiveWindow(conn, app) {
			return app, nil
		}
	}
	return apps[0], nil
}

func appHasActiveWindow(conn *dbus.Conn, app accessibleRef) bool {
	windows, err := getChildren(conn, app.Sender, app.Path)
	if err != nil {
		return false
	}
	for _, w := range windows {
		obj := conn.Object(w.Sender, w.Path)
		bits, err := getState(obj)
		if err != nil {
			continue
		}
		if stateBitSet(bits, stateActive) {
			return true
		}
	}
	return false
}

func getConnectionUnixProcessID(bus dbus.BusObject, sender string) (int, error) {
	var pid uint32
	if err := bus.Call("org.freedesktop.DBus.GetConnectionUnixProcessID", 0, sender).Store(&pid); err != nil {
		return 0, classifyDbusError(err)
	}
	return int(pid), nil
}

func (c *ComputerUse) getAppRootByPID(conn *dbus.Conn, pid int) (accessibleRef, error) {
	if pid <= 0 {
		return accessibleRef{}, fmt.Errorf("%w: pid must be positive", ErrInvalidRequest)
	}
	apps, err := getChildren(conn, atspiRegistryBus, atspiRootPath)
	if err != nil {
		return accessibleRef{}, err
	}
	bus := conn.BusObject()
	for _, app := range apps {
		appPID, err := getConnectionUnixProcessID(bus, app.Sender)
		if err != nil {
			if errors.Is(err, ErrNodeNotFound) {
				continue
			}
			return accessibleRef{}, err
		}
		if appPID == pid {
			return app, nil
		}
	}
	return accessibleRef{}, ErrNoAccessibleRoot
}

func (c *ComputerUse) getAccessibilityTree(scope A11yScope, pid, maxDepth int) (*A11yNode, bool, error) {
	conn, err := c.connectA11y()
	if err != nil {
		return nil, false, err
	}
	root, err := c.resolveScopeRoot(conn, scope, pid)
	if err != nil {
		return nil, false, err
	}
	walk := &treeWalk{conn: conn, budget: walkBudget}
	node, err := walk.node(root.Sender, root.Path, maxDepth)
	if err != nil {
		return nil, false, err
	}
	return node, walk.budget <= 0, nil
}

type treeWalk struct {
	conn   *dbus.Conn
	budget int
}

func (w *treeWalk) node(sender string, path dbus.ObjectPath, maxDepth int) (*A11yNode, error) {
	if w.budget <= 0 {
		return nil, nil
	}
	w.budget--
	node, err := fetchNodeMeta(w.conn, sender, path)
	if err != nil || maxDepth == 0 {
		return node, err
	}
	refs, err := getChildren(w.conn, sender, path)
	if err != nil {
		return node, missingNodeError(err, true)
	}
	node.Children, err = w.children(refs, childDepth(maxDepth))
	return node, err
}

func childDepth(maxDepth int) int {
	if maxDepth > 0 {
		return maxDepth - 1
	}
	return maxDepth
}

func (w *treeWalk) children(refs []accessibleRef, depth int) ([]*A11yNode, error) {
	var children []*A11yNode
	for _, ref := range refs {
		if w.budget <= 0 {
			break
		}
		child, err := w.node(ref.Sender, ref.Path, depth)
		if err != nil {
			if isDisappearingNodeError(err) {
				continue
			}
			return nil, err
		}
		if child != nil {
			children = append(children, child)
		}
	}
	return children, nil
}
