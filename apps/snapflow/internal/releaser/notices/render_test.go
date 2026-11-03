// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package notices

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const (
	testFileMode  = 0o644
	mitLicense    = "MIT License\n\nCopyright (c) Example\n\n"
	apacheLicense = "Apache License\nVersion 2.0, January 2004\n"
	apacheNotice  = "Example\nCopyright Example Authors\n"
)

func moduleWithFiles(t *testing.T, files map[string]string) Module {
	t.Helper()
	directory := t.TempDir()
	for name, contents := range files {
		if err := os.WriteFile(filepath.Join(directory, name), []byte(contents), testFileMode); err != nil {
			t.Fatal(err)
		}
	}
	return Module{Path: "example.com/module", Version: "v1.0.0", Dir: directory}
}

func TestRenderModuleIncludesNonApacheLicenseText(t *testing.T) {
	module := moduleWithFiles(t, map[string]string{"LICENSE": mitLicense, "NOTICE": apacheNotice})
	rendered, err := renderModule(module)
	if err != nil {
		t.Fatal(err)
	}
	want := "### example.com/module v1.0.0\n\n```text\nMIT License\n\nCopyright (c) Example\n```\n\n"
	if rendered != want {
		t.Fatalf("rendered = %q, want %q", rendered, want)
	}
}

func TestRenderModuleReferencesApacheLicenseAndIncludesNotice(t *testing.T) {
	module := moduleWithFiles(t, map[string]string{"LICENSE.txt": apacheLicense, "NOTICE.md": apacheNotice})
	rendered, err := renderModule(module)
	if err != nil {
		t.Fatal(err)
	}
	want := "### example.com/module v1.0.0\n\n" + apacheReference +
		"```text\nExample\nCopyright Example Authors\n```\n\n"
	if rendered != want {
		t.Fatalf("rendered = %q, want %q", rendered, want)
	}
}

func TestRenderModuleOmitsMissingApacheNotice(t *testing.T) {
	module := moduleWithFiles(t, map[string]string{"license": apacheLicense})
	rendered, err := renderModule(module)
	if err != nil {
		t.Fatal(err)
	}
	if want := "### example.com/module v1.0.0\n\n" + apacheReference; rendered != want {
		t.Fatalf("rendered = %q, want %q", rendered, want)
	}
}

func TestRenderModuleSelectsFirstLicenseByName(t *testing.T) {
	module := moduleWithFiles(t, map[string]string{
		"COPYING.md": "copying", "LICENSE.BSD": "bsd", "README.md": "readme",
	})
	rendered, err := renderModule(module)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(rendered, "```text\ncopying\n```") {
		t.Fatalf("rendered = %q, want COPYING.md contents", rendered)
	}
}

func TestRenderModuleRequiresLicense(t *testing.T) {
	module := moduleWithFiles(t, map[string]string{"README.md": "readme"})
	_, err := renderModule(module)
	if err == nil || !strings.Contains(err.Error(), "has no license file") {
		t.Fatalf("err = %v, want missing license failure", err)
	}
}

func TestRenderModuleRequiresModuleDirectory(t *testing.T) {
	if _, err := renderModule(Module{Path: "example.com/module", Version: "v1.0.0"}); err == nil {
		t.Fatal("module without a directory was accepted")
	}
}

func TestRenderModulesConcatenatesSectionsInOrder(t *testing.T) {
	first := moduleWithFiles(t, map[string]string{"LICENSE": "first"})
	second := moduleWithFiles(t, map[string]string{"LICENSE": "second"})
	second.Path = "example.com/second"
	rendered, err := renderModules([]Module{first, second})
	if err != nil {
		t.Fatal(err)
	}
	want := "### example.com/module v1.0.0\n\n```text\nfirst\n```\n\n" +
		"### example.com/second v1.0.0\n\n```text\nsecond\n```\n\n"
	if rendered != want {
		t.Fatalf("rendered = %q, want %q", rendered, want)
	}
}
