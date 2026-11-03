// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package guest

import "fmt"

type FailureCode string

const (
	FailurePlatformBundleMount       FailureCode = "PLATFORM_BUNDLE_MOUNT_FAILED"
	FailurePlatformComponentNotFound FailureCode = "PLATFORM_COMPONENT_NOT_FOUND"
	FailurePlatformComponentNotExec  FailureCode = "PLATFORM_COMPONENT_NOT_EXECUTABLE"
)

type Failure struct {
	code    FailureCode
	message string
	cause   error
}

type ControlProblem struct {
	Code      string
	Message   string
	Retryable bool
	Status    int
	Details   *ControlProblemDetails
}

type ControlProblemDetails struct {
	RetryAfterSeconds int    `json:"retryAfterSeconds,omitempty"`
	Step              string `json:"step,omitempty"`
}

func (problem *ControlProblem) Error() string {
	return fmt.Sprintf("%s: %s", problem.Code, problem.Message)
}

func NewFailure(code FailureCode, message string, cause error) error {
	return &Failure{code: code, message: message, cause: cause}
}

func (failure *Failure) Error() string {
	return fmt.Sprintf("%s: %s", failure.code, failure.message)
}

func (failure *Failure) ErrorCode() string { return string(failure.code) }

func (failure *Failure) Unwrap() error { return failure.cause }
