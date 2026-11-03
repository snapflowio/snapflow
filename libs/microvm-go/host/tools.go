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

package host

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/snapflowio/microvm-go/ext4"
)

const (
	ipv4ForwardingPath    = "/proc/sys/net/ipv4/ip_forward"
	ipv4ForwardingEnabled = "1"
)

func CheckExt4Tools() error {
	var missing []error
	for _, resolve := range []func() (string, error){ext4.MkfsPath, ext4.FsckPath, ext4.ResizePath} {
		if _, err := resolve(); err != nil {
			missing = append(missing, err)
		}
	}
	return errors.Join(missing...)
}

func CheckIPv4Forwarding() error {
	value, err := os.ReadFile(ipv4ForwardingPath)
	if err != nil {
		return fmt.Errorf("read IPv4 forwarding setting: %w", err)
	}
	if strings.TrimSpace(string(value)) != ipv4ForwardingEnabled {
		return errors.New("IPv4 forwarding is disabled; set net.ipv4.ip_forward=1 (the snapflow package installs /usr/lib/sysctl.d/60-snapflow.conf)")
	}
	return nil
}
