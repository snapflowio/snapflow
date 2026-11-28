// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package notices

import (
	"fmt"
	"os"
	"strings"
)

const (
	apacheReference = "License: Apache-2.0 (see [Apache License 2.0](#apache-license-20)).\n\n"
	textBlockOpen   = "```text\n"
	textBlockClose  = "\n```\n\n"
)

func renderModules(modules []Module) (string, error) {
	var rendered strings.Builder
	for _, module := range modules {
		section, err := renderModule(module)
		if err != nil {
			return "", err
		}
		rendered.WriteString(section)
	}
	return rendered.String(), nil
}

func renderModule(module Module) (string, error) {
	if module.Dir == "" {
		return "", fmt.Errorf("module %s@%s has no local directory; run go mod download", module.Path, module.Version)
	}
	license, err := readModuleFile(module, licensePrefixes())
	if err != nil {
		return "", err
	}
	if license == "" {
		return "", fmt.Errorf("module %s@%s has no license file", module.Path, module.Version)
	}
	heading := fmt.Sprintf("### %s %s\n\n", module.Path, module.Version)
	if !isApacheLicense(license) {
		return heading + textBlock(license), nil
	}
	notice, err := readModuleFile(module, noticePrefixes())
	if err != nil {
		return "", err
	}
	if notice == "" {
		return heading + apacheReference, nil
	}
	return heading + apacheReference + textBlock(notice), nil
}

func readModuleFile(module Module, prefixes []string) (string, error) {
	path, err := findFile(module.Dir, prefixes)
	if err != nil || path == "" {
		return "", err
	}
	contents, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read %s of module %s@%s: %w", path, module.Path, module.Version, err)
	}
	return string(contents), nil
}

func textBlock(contents string) string {
	return textBlockOpen + strings.TrimRight(contents, "\n") + textBlockClose
}
