// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build !linux && !darwin

package tuf

import "errors"

func requireAvailableStorage(string, uint64) error {
	return errors.New("the Snapflow release storage inspection requires Linux or macOS")
}
