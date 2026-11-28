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

package kvm

import (
	"fmt"
	"os"
)

const DevicePath = "/dev/kvm"

func CheckAccess() error {
	info, err := os.Stat(DevicePath)
	if err != nil {
		return fmt.Errorf("%s is not available; expose host KVM to boot microVM instances", DevicePath)
	}
	if info.IsDir() {
		return fmt.Errorf("%s is a directory, expected device", DevicePath)
	}
	file, err := os.OpenFile(DevicePath, os.O_RDWR, 0)
	if err != nil {
		return fmt.Errorf("%s is not readable/writable by this user: %w", DevicePath, err)
	}
	return file.Close()
}
