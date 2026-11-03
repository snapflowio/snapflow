// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package coderun

import (
	_ "embed"
	"encoding/base64"
	"fmt"
	"regexp"
	"strings"
)

//go:embed matplotlib_wrapper.py
var matplotlibWrapper string

type pythonToolbox struct{}

const (
	matplotlibImportPattern = `(?m)^[^#]*(?:import\s+matplotlib|from\s+matplotlib|__import__\s*\(\s*['"]matplotlib['"]|importlib\.import_module\s*\(\s*['"]matplotlib['"]|loader\.load_module\s*\(\s*['"]matplotlib['"]|sys\.modules\[['"]matplotlib['"]\])`
	encodedCodePlaceholder  = "{encoded_code}"
)

func (t *pythonToolbox) GetRunCommand(code string, argv []string) string {
	encodedCode := base64.StdEncoding.EncodeToString([]byte(code))

	if isMatplotlibImported(code) {
		wrappedCode := strings.Replace(matplotlibWrapper, encodedCodePlaceholder, encodedCode, 1)
		encodedCode = base64.StdEncoding.EncodeToString([]byte(wrappedCode))
	}

	return fmt.Sprintf("printf '%%s' '%s' | base64 -d | python3 -u - %s", encodedCode, formatArgv(argv))
}

func isMatplotlibImported(code string) bool {
	return regexp.MustCompile(matplotlibImportPattern).MatchString(code)
}
