// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package git

import "time"

type GitCommitInfo struct {
	Hash      string    `json:"hash" validate:"required"`
	Author    string    `json:"author" validate:"required"`
	Email     string    `json:"email" validate:"required"`
	Message   string    `json:"message" validate:"required"`
	Timestamp time.Time `json:"timestamp" validate:"required"`
} // @name GitCommitInfo
