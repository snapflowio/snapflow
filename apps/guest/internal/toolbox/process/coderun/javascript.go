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
)

type javascriptToolbox struct{}

func (t *javascriptToolbox) GetRunCommand(code string, argv []string) string {
	encodedCode := base64.StdEncoding.EncodeToString([]byte("process.argv.splice(1, 1);\n" + code))
	return fmt.Sprintf("printf '%%s' '%s' | base64 -d | node - %s", encodedCode, formatArgv(argv))
}
