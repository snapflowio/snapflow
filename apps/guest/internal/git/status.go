// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package git

import (
	"context"
	"os/exec"
	"strconv"
	"strings"

	"github.com/go-git/go-git/v5"
)

const (
	gitExecutable      = "git"
	aheadBehindColumns = 2
	countSeparator     = "\t"
)

func statusOf(code git.StatusCode) Status {
	switch code {
	case git.Untracked:
		return Untracked
	case git.Modified:
		return Modified
	case git.Added:
		return Added
	case git.Deleted:
		return Deleted
	case git.Renamed:
		return Renamed
	case git.Copied:
		return Copied
	case git.UpdatedButUnmerged:
		return UpdatedButUnmerged
	default:
		return Unmodified
	}
}

func (s *Service) GetGitStatus(ctx context.Context) (*GitStatus, error) {
	repo, err := git.PlainOpen(s.WorkDir)
	if err != nil {
		return nil, err
	}
	ref, err := repo.Head()
	if err != nil {
		return nil, err
	}
	worktree, err := repo.Worktree()
	if err != nil {
		return nil, err
	}
	status, err := worktree.Status()
	if err != nil {
		return nil, err
	}
	files := []*FileStatus{}
	for path, file := range status {
		files = append(files, &FileStatus{
			Name:     path,
			Extra:    file.Extra,
			Staging:  statusOf(file.Staging),
			Worktree: statusOf(file.Worktree),
		})
	}
	upstream := s.upstreamBranch(ctx)
	ahead, behind := s.aheadBehind(ctx, upstream)
	return &GitStatus{
		CurrentBranch:   ref.Name().Short(),
		Files:           files,
		BranchPublished: upstream != "",
		Ahead:           ahead,
		Behind:          behind,
	}, nil
}

func (s *Service) upstreamBranch(ctx context.Context) string {
	cmd := exec.CommandContext(ctx, gitExecutable, "-C", s.WorkDir, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
	out, exitCode, err := s.Reaper.CombinedOutput(cmd)
	if err != nil || exitCode != 0 {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func (s *Service) aheadBehind(ctx context.Context, upstream string) (int, int) {
	if upstream == "" {
		return 0, 0
	}
	cmd := exec.CommandContext(ctx, gitExecutable, "-C", s.WorkDir, "rev-list", "--left-right", "--count", upstream+"...HEAD")
	out, exitCode, err := s.Reaper.CombinedOutput(cmd)
	if err != nil || exitCode != 0 {
		return 0, 0
	}
	return parseAheadBehind(out)
}

func parseAheadBehind(output []byte) (int, int) {
	counts := strings.Split(strings.TrimSpace(string(output)), countSeparator)
	if len(counts) != aheadBehindColumns {
		return 0, 0
	}
	behind, behindErr := strconv.Atoi(counts[0])
	ahead, aheadErr := strconv.Atoi(counts[1])
	if behindErr != nil || aheadErr != nil {
		return 0, 0
	}
	return ahead, behind
}
