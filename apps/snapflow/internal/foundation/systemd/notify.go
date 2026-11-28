// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package systemd

import (
	"fmt"
	"time"

	sddaemon "github.com/coreos/go-systemd/v22/daemon"
)

const (
	Ready    = sddaemon.SdNotifyReady
	Stopping = sddaemon.SdNotifyStopping
	Watchdog = sddaemon.SdNotifyWatchdog
)

const (
	statusPrefix        = "STATUS="
	extendTimeoutFormat = "EXTEND_TIMEOUT_USEC=%d"
)

func Status(text string) string {
	return statusPrefix + text
}

func ExtendTimeout(timeout time.Duration) string {
	return fmt.Sprintf(extendTimeoutFormat, timeout.Microseconds())
}

const keepEnvironment = false

type Notifier interface {
	Notify(state string) error
	WatchdogInterval() (time.Duration, error)
}

type SocketNotifier struct{}

var _ Notifier = SocketNotifier{}

func (SocketNotifier) Notify(state string) error {
	if _, err := sddaemon.SdNotify(keepEnvironment, state); err != nil {
		return fmt.Errorf("notify systemd %q: %w", state, err)
	}
	return nil
}

func (SocketNotifier) WatchdogInterval() (time.Duration, error) {
	interval, err := sddaemon.SdWatchdogEnabled(keepEnvironment)
	if err != nil {
		return 0, fmt.Errorf("read the systemd watchdog interval: %w", err)
	}
	return interval, nil
}
