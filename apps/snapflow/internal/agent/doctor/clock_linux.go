// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package doctor

import (
	"context"
	"errors"
	"fmt"

	godbus "github.com/godbus/dbus/v5"
)

const (
	timedateService         = "org.freedesktop.timedate1"
	timedateObject          = godbus.ObjectPath("/org/freedesktop/timedate1")
	propertiesGetMethod     = "org.freedesktop.DBus.Properties.Get"
	ntpSynchronizedProperty = "NTPSynchronized"
	dbusCallFlags           = 0
)

var errClockUnsynchronized = errors.New("the system clock is not synchronized to a time source")

func clockSynchronized(ctx context.Context) error {
	connection, err := godbus.ConnectSystemBus(godbus.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("connect to the system bus to read the clock state: %w", err)
	}
	defer connection.Close()
	var synchronized bool
	call := connection.Object(timedateService, timedateObject).
		CallWithContext(ctx, propertiesGetMethod, dbusCallFlags, timedateService, ntpSynchronizedProperty)
	if err := call.Store(&synchronized); err != nil {
		return fmt.Errorf("read %s from systemd-timedated: %w", ntpSynchronizedProperty, err)
	}
	if !synchronized {
		return errClockUnsynchronized
	}
	return nil
}
