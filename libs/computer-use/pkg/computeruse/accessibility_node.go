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
	"context"
	"fmt"
	"strings"

	"github.com/godbus/dbus/v5"
)

func makeNodeID(sender string, path dbus.ObjectPath) string {
	return sender + ":" + string(path)
}

func parseNodeID(id string) (string, dbus.ObjectPath, error) {
	slash := strings.Index(id, "/")
	if slash <= 1 {
		return "", "", fmt.Errorf("%w: invalid node id %q: missing object path", ErrInvalidRequest, id)
	}
	if id[slash-1] != ':' {
		return "", "", fmt.Errorf("%w: invalid node id %q: missing ':' separator before object path", ErrInvalidRequest, id)
	}
	sender := id[:slash-1]
	path := dbus.ObjectPath(id[slash:])
	if sender == "" {
		return "", "", fmt.Errorf("%w: invalid node id %q: empty bus name", ErrInvalidRequest, id)
	}
	if !path.IsValid() {
		return "", "", fmt.Errorf("%w: invalid node id %q: malformed object path", ErrInvalidRequest, id)
	}
	return sender, path, nil
}

const stateWordBits = 32

func stateBitsToNames(bits []uint32) []string {
	if len(bits) == 0 {
		return nil
	}
	var out []string
	for index, name := range atspiStateNames() {
		if stateBitSet(bits, index) {
			out = append(out, name)
		}
	}
	return out
}

func stateBitSet(bits []uint32, bit int) bool {
	word := bit / stateWordBits
	if word >= len(bits) {
		return false
	}
	return bits[word]&(1<<uint(bit%stateWordBits)) != 0
}

func getStringProp(obj dbus.BusObject, prop string) string {
	v, err := obj.GetProperty(prop)
	if err != nil {
		return ""
	}
	if s, ok := v.Value().(string); ok {
		return s
	}
	return ""
}

func getChildren(conn *dbus.Conn, sender string, path dbus.ObjectPath) ([]accessibleRef, error) {
	return getChildrenContext(context.Background(), conn, sender, path)
}

func getChildrenContext(ctx context.Context, conn *dbus.Conn, sender string, path dbus.ObjectPath) ([]accessibleRef, error) {
	obj := conn.Object(sender, path)
	var refs []accessibleRef
	if err := obj.CallWithContext(ctx, ifaceAccessible+".GetChildren", 0).Store(&refs); err != nil {
		return nil, classifyDbusError(err)
	}
	return refs, nil
}

func getState(obj dbus.BusObject) ([]uint32, error) {
	var bits []uint32
	if err := obj.Call(ifaceAccessible+".GetState", 0).Store(&bits); err != nil {
		return nil, classifyDbusError(err)
	}
	return bits, nil
}

func getInterfaces(obj dbus.BusObject) []string {
	var ifaces []string
	if err := obj.Call(ifaceAccessible+".GetInterfaces", 0).Store(&ifaces); err != nil {
		return nil
	}
	return ifaces
}

func containsStr(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}

func getExtents(obj dbus.BusObject) (A11yBounds, bool) {
	var ext struct {
		X, Y, W, H int32
	}
	if err := obj.Call(ifaceComponent+".GetExtents", 0, coordTypeScreen).Store(&ext); err != nil {
		return A11yBounds{}, false
	}
	return A11yBounds{X: int(ext.X), Y: int(ext.Y), Width: int(ext.W), Height: int(ext.H)}, true
}

func getActionNames(obj dbus.BusObject) ([]string, error) {
	v, err := obj.GetProperty(ifaceAction + ".NActions")
	if err != nil {
		return nil, classifyDbusError(err)
	}
	count, ok := v.Value().(int32)
	if !ok || count <= 0 {
		return nil, nil
	}
	out := make([]string, 0, count)
	for i := int32(0); i < count; i++ {
		var name string
		if err := obj.Call(ifaceAction+".GetName", 0, i).Store(&name); err != nil {
			return nil, classifyDbusError(err)
		}
		out = append(out, name)
	}
	return out, nil
}

func fetchNodeMeta(conn *dbus.Conn, sender string, path dbus.ObjectPath) (*A11yNode, error) {
	obj := conn.Object(sender, path)

	var role string
	if err := obj.Call(ifaceAccessible+".GetRoleName", 0).Store(&role); err != nil {
		return nil, classifyDbusError(err)
	}

	ifaces := getInterfaces(obj)

	node := &A11yNode{
		ID:          makeNodeID(sender, path),
		Role:        role,
		Name:        getStringProp(obj, ifaceAccessible+".Name"),
		Description: getStringProp(obj, ifaceAccessible+".Description"),
	}

	if bits, err := getState(obj); err == nil {
		node.States = stateBitsToNames(bits)
	}

	if containsStr(ifaces, ifaceComponent) {
		if b, ok := getExtents(obj); ok {
			node.Bounds = b
		}
	}

	if containsStr(ifaces, ifaceAction) {
		if actions, err := getActionNames(obj); err == nil {
			node.Actions = actions
		}
	}

	return node, nil
}
