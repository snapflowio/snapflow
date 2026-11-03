// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package coderun

import (
	"encoding/base64"
	"fmt"
	"strings"
)

type typescriptToolbox struct{}

func (t *typescriptToolbox) GetRunCommand(code string, argv []string) string {
	encodedCode := base64.StdEncoding.EncodeToString([]byte("process.argv.splice(1, 1);\n" + code))

	parts := []string{
		`_f=/tmp/dtn_$$.ts`,
		fmt.Sprintf(`printf '%%s' '%s' | base64 -d > "$_f"`, encodedCode),
		fmt.Sprintf(`npm_config_loglevel=error npx ts-node -T --ignore-diagnostics 5107 -O '{"module":"CommonJS"}' "$_f" %s`, formatArgv(argv)),
		`_dtn_ec=$?`,
		`rm -f "$_f"`,
		`exit $_dtn_ec`,
	}

	return strings.Join(parts, "; ")
}
