// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"errors"
	"time"
)

type Credentials struct {
	ID         string
	Token      string
	Generation int32
	IssuedAt   time.Time
}

func (credentials Credentials) Validate() error {
	if credentials.ID == "" || credentials.Token == "" || credentials.Generation < 1 ||
		credentials.IssuedAt.IsZero() {
		return errors.New("edge session ID, token, generation, and issue time are required")
	}
	return nil
}
