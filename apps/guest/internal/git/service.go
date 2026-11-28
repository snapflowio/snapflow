// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package git

import "github.com/snapflowio/guest/internal/childreap"

type GitStatus struct {
	CurrentBranch   string        `json:"currentBranch" validate:"required"`
	Files           []*FileStatus `json:"fileStatus" validate:"required"`
	BranchPublished bool          `json:"branchPublished" validate:"optional"`
	Ahead           int           `json:"ahead" validate:"optional"`
	Behind          int           `json:"behind" validate:"optional"`
} // @name GitStatus

type FileStatus struct {
	Name     string `json:"name" validate:"required"`
	Extra    string `json:"extra" validate:"required"`
	Staging  Status `json:"staging" validate:"required"`
	Worktree Status `json:"worktree" validate:"required"`
} // @name FileStatus

type Status string // @name Status

const (
	Unmodified         Status = "unmodified"
	Untracked          Status = "untracked"
	Modified           Status = "modified"
	Added              Status = "added"
	Deleted            Status = "deleted"
	Renamed            Status = "renamed"
	Copied             Status = "copied"
	UpdatedButUnmerged Status = "updated_but_unmerged"
)

type Service struct {
	WorkDir string
	Reaper  *childreap.Reaper
}
