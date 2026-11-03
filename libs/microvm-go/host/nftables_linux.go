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
	"fmt"

	"github.com/google/nftables"
)

func CheckNftablesAccess() error {
	connection, err := nftables.New()
	if err != nil {
		return fmt.Errorf("initialize nftables netlink client: %w", err)
	}
	if _, err := connection.ListTablesOfFamily(nftables.TableFamilyIPv4); err != nil {
		return fmt.Errorf("host network policy requires nftables netlink access: %w", err)
	}
	return nil
}
