// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package notices

import (
	"slices"
	"strings"
	"testing"
)

const fakeGoList = `{"ImportPath":"fmt"}
{"Module":{"Path":"golang.org/x/sys","Version":"v0.30.0","Dir":"/cache/golang.org/x/sys@v0.30.0"}}
{"Module":{"Path":"github.com/snapflowio/snapflow","Dir":"/workspace/apps/snapflow"}}
{"Module":{"Path":"github.com/KyleBanks/depth","Version":"v1.2.1","Dir":"/cache/github.com/!kyle!banks/depth@v1.2.1"}}
{"Module":{"Path":"golang.org/x/sys","Version":"v0.30.0","Dir":"/cache/golang.org/x/sys@v0.30.0"}}
`

func TestDecodeModulesSkipsStandardLibraryAndFirstParty(t *testing.T) {
	modules, err := decodeModules(strings.NewReader(fakeGoList))
	if err != nil {
		t.Fatal(err)
	}
	want := []Module{
		{Path: "golang.org/x/sys", Version: "v0.30.0", Dir: "/cache/golang.org/x/sys@v0.30.0"},
		{Path: "github.com/KyleBanks/depth", Version: "v1.2.1", Dir: "/cache/github.com/!kyle!banks/depth@v1.2.1"},
		{Path: "golang.org/x/sys", Version: "v0.30.0", Dir: "/cache/golang.org/x/sys@v0.30.0"},
	}
	if !slices.Equal(modules, want) {
		t.Fatalf("modules = %v, want %v", modules, want)
	}
}

func TestDecodeModulesRejectsMalformedStream(t *testing.T) {
	if _, err := decodeModules(strings.NewReader(`{"Module":`)); err == nil {
		t.Fatal("malformed go list output was accepted")
	}
}

func TestUniqueSortedOrdersBytewiseAndDeduplicates(t *testing.T) {
	modules := []Module{
		{Path: "golang.org/x/sys", Version: "v0.30.0"},
		{Path: "github.com/apex/log", Version: "v1.4.0"},
		{Path: "github.com/KyleBanks/depth", Version: "v1.2.1"},
		{Path: "golang.org/x/sys", Version: "v0.30.0"},
		{Path: "golang.org/x/sys", Version: "v0.29.0"},
	}
	want := []Module{
		{Path: "github.com/KyleBanks/depth", Version: "v1.2.1"},
		{Path: "github.com/apex/log", Version: "v1.4.0"},
		{Path: "golang.org/x/sys", Version: "v0.29.0"},
		{Path: "golang.org/x/sys", Version: "v0.30.0"},
	}
	if got := uniqueSorted(modules); !slices.Equal(got, want) {
		t.Fatalf("uniqueSorted = %v, want %v", got, want)
	}
}
