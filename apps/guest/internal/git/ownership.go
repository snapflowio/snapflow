// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package git

import "github.com/snapflowio/guest/internal/sandbox"

func (s *Service) afterWrite(err error) error {
	if err != nil {
		return err
	}
	return s.handOver()
}

func (s *Service) handOver() error {
	user, err := sandbox.DefaultUser()
	if err != nil {
		return err
	}
	return user.OwnTree(s.WorkDir)
}
