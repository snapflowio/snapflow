// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package git

import (
	"github.com/go-git/go-git/v5/plumbing/object"

	"github.com/go-git/go-git/v5"
)

func (s *Service) Log() ([]GitCommitInfo, error) {
	repo, err := git.PlainOpen(s.WorkDir)
	if err != nil {
		return []GitCommitInfo{}, err
	}

	ref, err := repo.Head()
	if err != nil {
		return []GitCommitInfo{}, err
	}

	commits, err := repo.Log(&git.LogOptions{From: ref.Hash()})
	if err != nil {
		return []GitCommitInfo{}, err
	}

	var history []GitCommitInfo
	err = commits.ForEach(func(commit *object.Commit) error {
		history = append(history, GitCommitInfo{
			Hash:      commit.Hash.String(),
			Author:    commit.Author.Name,
			Email:     commit.Author.Email,
			Message:   commit.Message,
			Timestamp: commit.Author.When,
		})
		return nil
	})

	return history, err
}
