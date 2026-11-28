// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package git

import (
	"errors"
	"net/http"

	go_git "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/transport"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
)

const internalServerErrorCode = "INTERNAL_SERVER_ERROR"

type errorClass struct {
	causes []error
	wrap   func(error) error
}

func errorClasses() []errorClass {
	return []errorClass{
		{
			causes: []error{transport.ErrAuthenticationRequired, transport.ErrInvalidAuthMethod},
			wrap:   common_errors.NewUnauthorizedError,
		},
		{
			causes: []error{transport.ErrAuthorizationFailed},
			wrap:   common_errors.NewForbiddenError,
		},
		{
			causes: []error{
				transport.ErrRepositoryNotFound, transport.ErrEmptyRemoteRepository, go_git.ErrRepositoryNotExists,
				go_git.ErrBranchNotFound, go_git.ErrRemoteNotFound, go_git.ErrTagNotFound,
				plumbing.ErrReferenceNotFound, plumbing.ErrObjectNotFound,
			},
			wrap: common_errors.NewNotFoundError,
		},
		{
			causes: []error{
				go_git.ErrNonFastForwardUpdate, go_git.ErrWorktreeNotClean, go_git.ErrUnstagedChanges,
				go_git.ErrRepositoryAlreadyExists, go_git.ErrBranchExists, go_git.ErrFastForwardMergeNotPossible,
			},
			wrap: common_errors.NewConflictError,
		},
	}
}

func classifyGitError(err error) error {
	for _, class := range errorClasses() {
		for _, cause := range class.causes {
			if errors.Is(err, cause) {
				return class.wrap(err)
			}
		}
	}
	return common_errors.NewCustomError(http.StatusInternalServerError, err.Error(), internalServerErrorCode)
}
