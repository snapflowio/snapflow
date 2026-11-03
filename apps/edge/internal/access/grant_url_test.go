// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"net/url"
	"testing"
)

func TestWithoutAccessParametersKeepsTheRestOfTheQueryVerbatim(t *testing.T) {
	t.Parallel()
	for raw, want := range map[string]string{
		"z=1&a=2&flag&x=1;y=2": "z=1&a=2&flag&x=1;y=2",
		"keep=1&" + GrantQueryParameter + "=g&" + BackendQueryParameter + "=b": "keep=1",
		GrantQueryParameter + "=g":                        "",
		"sig=a%2Bb&" + GrantQueryParameter + "=g&order=2": "sig=a%2Bb&order=2",
		"": "",
	} {
		if got := withoutAccessParameters(raw); got != want {
			t.Fatalf("withoutAccessParameters(%q) = %q, want %q", raw, got, want)
		}
	}
}

func TestSameHostLocationNeverLeavesTheHost(t *testing.T) {
	t.Parallel()
	for target, want := range map[string]string{
		"https://app.example.test//evil.example/x?keep=1": "/evil.example/x?keep=1",
		"https://app.example.test/page":                   "/page",
		"https://app.example.test":                        "/",
	} {
		parsed, err := url.Parse(target)
		if err != nil {
			t.Fatalf("parse %q: %v", target, err)
		}
		if got := sameHostLocation(parsed); got != want {
			t.Fatalf("sameHostLocation(%q) = %q, want %q", target, got, want)
		}
	}
}
