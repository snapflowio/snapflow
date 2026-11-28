// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package git

import (
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/protocol/packp/capability"
	"github.com/go-git/go-git/v5/plumbing/transport"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/snapflowio/guest/internal/sandbox"
)

const cloneDirectoryMode = 0o755

type CloneOptions struct {
	URL             string
	Branch          string
	CommitSHA       string
	Auth            *http.BasicAuth
	InsecureSkipTLS bool
}

func (s *Service) Clone(options CloneOptions) error {
	cloneOptions := &git.CloneOptions{
		URL:             options.URL,
		SingleBranch:    true,
		InsecureSkipTLS: options.InsecureSkipTLS,
		Auth:            options.Auth,
	}
	transport.UnsupportedCapabilities = []capability.Capability{capability.ThinPack}
	if options.Branch != "" {
		cloneOptions.ReferenceName = plumbing.NewBranchReferenceName(options.Branch)
	}
	user, err := sandbox.DefaultUser()
	if err != nil {
		return err
	}
	if err := user.MkdirAll(s.WorkDir, cloneDirectoryMode); err != nil {
		return err
	}
	repository, err := git.PlainClone(s.WorkDir, false, cloneOptions)
	if err != nil {
		return err
	}
	if options.CommitSHA == "" {
		return user.OwnTree(s.WorkDir)
	}
	worktree, err := repository.Worktree()
	if err != nil {
		return err
	}
	if err := worktree.Checkout(&git.CheckoutOptions{Hash: plumbing.NewHash(options.CommitSHA)}); err != nil {
		return err
	}
	return user.OwnTree(s.WorkDir)
}
