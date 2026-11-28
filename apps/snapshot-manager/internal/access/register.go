// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"fmt"
	"sync"

	"github.com/distribution/distribution/v3/registry/auth"
)

//nolint:gochecknoglobals // distribution keeps access controllers in a process-wide registry that accepts each name once
var registerOnce = sync.OnceValue(register)

func Register() error {
	return registerOnce()
}

func register() error {
	for _, name := range []string{Name, MirrorName} {
		if err := auth.Register(name, newAccessController); err != nil {
			return fmt.Errorf("register %s access controller: %w", name, err)
		}
	}
	return nil
}
