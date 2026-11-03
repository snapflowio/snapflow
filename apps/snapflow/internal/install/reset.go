// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package install

import (
	"errors"
	"fmt"
	"os"
)

type ResetResult struct {
	Removed []string `json:"removed"`
}

func (manager *Manager) Reset() (ResetResult, error) {
	if !manager.cfg.AllowReset {
		return ResetResult{}, errors.New("this Snapflow profile does not permit release-state reset")
	}
	result := ResetResult{}
	lock, err := manager.acquire()
	if err != nil {
		return ResetResult{}, err
	}
	if err := manager.requireMachineStopped(); err != nil {
		return ResetResult{}, errors.Join(err, lock.Close())
	}
	for _, root := range []string{manager.cfg.InstallationRoot, manager.cfg.StateRoot} {
		if err := os.RemoveAll(root); err != nil {
			return ResetResult{}, errors.Join(
				fmt.Errorf("remove development runtime root %q: %w", root, err),
				lock.Close(),
			)
		}
		result.Removed = append(result.Removed, root)
	}
	if err := lock.Close(); err != nil {
		return ResetResult{}, fmt.Errorf("release management lock: %w", err)
	}
	if err := os.RemoveAll(manager.cfg.RuntimeRoot); err != nil {
		return ResetResult{}, fmt.Errorf("remove development management runtime %q: %w", manager.cfg.RuntimeRoot, err)
	}
	result.Removed = append(result.Removed, manager.cfg.RuntimeRoot)
	return result, nil
}
