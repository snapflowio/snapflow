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

package control

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"golang.org/x/sys/unix"
)

const (
	defaultNetworkInterface = "eth0"
	resolverConfigPath      = "/etc/resolv.conf"
	randomDevicePath        = "/dev/urandom"
	ipv4AddressBits         = 32
	publicFileMode          = 0o644
	readOnlyFileMode        = 0o444
)

func setHostname(hostname string) error {
	if err := unix.Sethostname([]byte(hostname)); err != nil {
		return fmt.Errorf("set hostname: %w", err)
	}
	return nil
}

func ApplyHostIdentity(hostname, machineID string) error {
	return applyHostIdentityFiles(hostIdentityFiles{
		hostname:      "/etc/hostname",
		machineID:     "/etc/machine-id",
		dbusMachineID: "/var/lib/dbus/machine-id",
	}, hostname, machineID, setHostname)
}

type hostIdentityFiles struct {
	hostname      string
	machineID     string
	dbusMachineID string
}

func applyHostIdentityFiles(files hostIdentityFiles, hostname, machineID string, setKernelHostname func(string) error) error {
	if err := setKernelHostname(hostname); err != nil {
		return err
	}
	committed := []string{files.hostname, files.machineID}
	if err := atomicfile.Replace(files.hostname, []byte(hostname+"\n"), publicFileMode); err != nil {
		return fmt.Errorf("persist hostname: %w", err)
	}
	if err := atomicfile.Replace(files.machineID, []byte(machineID+"\n"), readOnlyFileMode); err != nil {
		return fmt.Errorf("persist machine id: %w", err)
	}
	if info, err := os.Lstat(files.dbusMachineID); err == nil && info.Mode().IsRegular() {
		if err := atomicfile.Replace(files.dbusMachineID, []byte(machineID+"\n"), readOnlyFileMode); err != nil {
			return fmt.Errorf("persist D-Bus machine id: %w", err)
		}
		committed = append(committed, files.dbusMachineID)
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("inspect D-Bus machine id: %w", err)
	}
	if err := atomicfile.Commit(committed...); err != nil {
		return fmt.Errorf("persist guest identity files: %w", err)
	}
	return nil
}

func reseedRandom(seed []byte) error {
	device, err := os.OpenFile(randomDevicePath, os.O_WRONLY, 0)
	if err != nil {
		return fmt.Errorf("open random device: %w", err)
	}
	defer device.Close()
	if _, err := device.Write(seed); err != nil {
		return fmt.Errorf("mix host seed into the guest random pool: %w", err)
	}
	if err := unix.IoctlSetInt(int(device.Fd()), unix.RNDRESEEDCRNG, 0); err != nil {
		return fmt.Errorf("reseed guest random generator: %w", err)
	}
	return nil
}

func syncGuestClock(hostTime time.Time) error {
	if hostTime.IsZero() {
		return fmt.Errorf("host time is required")
	}
	timespec := unix.NsecToTimespec(hostTime.UnixNano())
	if err := unix.ClockSettime(unix.CLOCK_REALTIME, &timespec); err != nil {
		return fmt.Errorf("synchronize guest clock: %w", err)
	}
	return nil
}
