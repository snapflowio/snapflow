// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package cli

import (
	"errors"
	"fmt"
	"testing"
)

func TestFromErrorMapsStatuses(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want int
	}{
		{name: "success", err: nil, want: ExitSuccess},
		{name: "plain error", err: errors.New("bad flag"), want: ExitConfigurationError},
		{name: "coded error", err: ExitWith(ExitRuntimeError), want: ExitRuntimeError},
		{name: "wrapped coded error", err: fmt.Errorf("run: %w", ExitWith(ExitTerminated)), want: ExitTerminated},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := ExitCode(testCase.err); got != testCase.want {
				t.Fatalf("FromError() = %d, want %d", got, testCase.want)
			}
		})
	}
}

func TestAsErrorReturnsNilForSuccess(t *testing.T) {
	if err := ExitWith(ExitSuccess); err != nil {
		t.Fatalf("AsError(Success) = %v, want nil", err)
	}
}

func TestReportShowsFailuresWithHints(t *testing.T) {
	failure := fmt.Errorf("setup: %w", Fail(ExitPermissionDenied, errors.New("needs root"), "use sudo"))
	message, hint, show := Report(failure)
	if !show || message != "setup: needs root" || hint != "use sudo" || ExitCode(failure) != ExitPermissionDenied {
		t.Fatalf("Report() = %q, %q, %t; code %d", message, hint, show, ExitCode(failure))
	}
	if message, hint, show := Report(ExitWith(ExitRuntimeError)); show {
		t.Fatalf("an already reported status was shown again: %q, %q", message, hint)
	}
	if message, hint, show := Report(errors.New("plain")); !show || message != "plain" || hint != "" {
		t.Fatalf("Report(plain) = %q, %q, %t", message, hint, show)
	}
}
