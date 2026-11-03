// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"embed"
	"errors"
	"io/fs"
)

const embeddedRootPath = "trust/root.json"

//go:embed trust
var trust embed.FS

var ErrNoEmbeddedRoot = errors.New("this Snapflow build has no release trust root; install an official release")

func EmbeddedRoot() ([]byte, error) {
	encoded, err := fs.ReadFile(trust, embeddedRootPath)
	if errors.Is(err, fs.ErrNotExist) || (err == nil && len(encoded) == 0) {
		return nil, ErrNoEmbeddedRoot
	}
	return encoded, err
}
