// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package contract

const (
	Host        = "127.0.0.1"
	HealthRoute = "/"
)

type HealthResponse struct {
	Status  string `json:"status" validate:"required"`
	Version string `json:"version" validate:"required"`
} //	@name	MachineHealth
