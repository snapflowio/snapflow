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

//go:build linux

package host

import (
	"context"
	"fmt"
	"time"

	systemd "github.com/coreos/go-systemd/v22/dbus"
)

const systemdProbeTimeout = 5 * time.Second

// CheckSystemd confirms the system manager answers on D-Bus; every VMM runs in
// a transient systemd scope that enforces its resource limits.
func CheckSystemd() error {
	ctx, cancel := context.WithTimeout(context.Background(), systemdProbeTimeout)
	defer cancel()
	connection, err := systemd.NewSystemConnectionContext(ctx)
	if err != nil {
		return fmt.Errorf("systemd is unreachable on D-Bus: %w", err)
	}
	connection.Close()
	return nil
}
