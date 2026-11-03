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
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/godbus/dbus/v5"
)

const (
	atspiRegistryBus  = "org.a11y.atspi.Registry"
	atspiRootPath     = dbus.ObjectPath("/org/a11y/atspi/accessible/root")
	atspiBusServiceBN = "org.a11y.Bus"
	atspiBusServiceOP = dbus.ObjectPath("/org/a11y/bus")

	ifaceAccessible   = "org.a11y.atspi.Accessible"
	ifaceComponent    = "org.a11y.atspi.Component"
	ifaceAction       = "org.a11y.atspi.Action"
	ifaceEditableText = "org.a11y.atspi.EditableText"
	ifaceValue        = "org.a11y.atspi.Value"
	ifaceApplication  = "org.a11y.atspi.Application"

	coordTypeScreen uint32 = 0

	walkBudget = 20000

	stateActive = 1

	a11yStatusTimeout = 100 * time.Millisecond
	a11yStatusTTL     = 2 * time.Second

	accessibilityBusName = "atspi"
)

func atspiStateNames() []string {
	return []string{
		"invalid",
		"active",
		"armed",
		"busy",
		"checked",
		"collapsed",
		"defunct",
		"editable",
		"enabled",
		"expandable",
		"expanded",
		"focusable",
		"focused",
		"has_tooltip",
		"horizontal",
		"iconified",
		"modal",
		"multi_line",
		"multiselectable",
		"opaque",
		"pressed",
		"resizable",
		"selectable",
		"selected",
		"sensitive",
		"showing",
		"single_line",
		"stale",
		"transient",
		"vertical",
		"visible",
		"manages_descendants",
		"indeterminate",
		"required",
		"truncated",
		"animated",
		"invalid_entry",
		"supports_autocompletion",
		"selectable_text",
		"is_default",
		"visited",
		"checkable",
		"has_popup",
		"read_only",
	}
}

type accessibleRef struct {
	Sender string
	Path   dbus.ObjectPath
}

func (c *ComputerUse) connectA11y() (*dbus.Conn, error) {
	return c.connectA11yContext(context.Background())
}

func (c *ComputerUse) connectA11yContext(ctx context.Context) (*dbus.Conn, error) {
	c.atspiMu.Lock()
	defer c.atspiMu.Unlock()

	if c.atspiConn != nil && c.atspiConn.Connected() {
		return c.atspiConn, nil
	}
	if c.atspiConn != nil {
		if err := c.atspiConn.Close(); err != nil {
			slog.Debug("Failed to close stale AT-SPI connection", "error", err)
		}
	}
	c.atspiConn = nil

	sess, err := dbus.SessionBus()
	if err != nil {
		return nil, fmt.Errorf("%w: session bus: %w", ErrA11yUnavailable, err)
	}

	var addr string
	busObj := sess.Object(atspiBusServiceBN, atspiBusServiceOP)
	if err := busObj.CallWithContext(ctx, "org.a11y.Bus.GetAddress", 0).Store(&addr); err != nil {
		return nil, fmt.Errorf("%w: GetAddress: %w", ErrA11yUnavailable, err)
	}
	if addr == "" {
		return nil, fmt.Errorf("%w: GetAddress returned empty address", ErrA11yUnavailable)
	}

	conn, err := dbus.Connect(addr)
	if err != nil {
		return nil, fmt.Errorf("%w: dial %s: %w", ErrA11yUnavailable, addr, err)
	}

	c.atspiConn = conn
	return conn, nil
}

func (c *ComputerUse) cachedA11yAvailable() bool {
	c.a11yStatusMu.Lock()
	running := c.a11yStatusRunning
	fresh := time.Since(c.a11yStatusCheckedAt) < a11yStatusTTL
	c.a11yStatusMu.Unlock()
	if fresh {
		return running
	}

	running = c.checkA11yAvailable(a11yStatusTimeout)
	c.setA11yStatus(running)
	return running
}

func (c *ComputerUse) setA11yStatus(running bool) {
	c.a11yStatusMu.Lock()
	c.a11yStatusRunning = running
	c.a11yStatusCheckedAt = time.Now()
	c.a11yStatusMu.Unlock()
}

func (c *ComputerUse) invalidateA11yStatus() {
	c.a11yStatusMu.Lock()
	c.a11yStatusCheckedAt = time.Time{}
	c.a11yStatusMu.Unlock()
}

func (c *ComputerUse) checkA11yAvailable(timeout time.Duration) bool {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	conn, err := c.connectA11yContext(ctx)
	if err != nil {
		return false
	}
	_, err = getChildrenContext(ctx, conn, atspiRegistryBus, atspiRootPath)
	return err == nil
}

func dbusErrorName(err error) string {
	var reference *dbus.Error
	if errors.As(err, &reference) {
		return reference.Name
	}
	var value dbus.Error
	if errors.As(err, &value) {
		return value.Name
	}
	return ""
}

func classifyDbusError(err error) error {
	if err == nil {
		return nil
	}
	switch dbusErrorName(err) {
	case "org.freedesktop.DBus.Error.UnknownMethod",
		"org.freedesktop.DBus.Error.UnknownInterface",
		"org.freedesktop.DBus.Error.UnknownProperty",
		"org.freedesktop.DBus.Error.NotSupported":
		return ErrActionNotSupported
	case "org.freedesktop.DBus.Error.ServiceUnknown",
		"org.freedesktop.DBus.Error.NameHasNoOwner",
		"org.freedesktop.DBus.Error.UnknownObject":
		return ErrNodeNotFound
	}
	return err
}
