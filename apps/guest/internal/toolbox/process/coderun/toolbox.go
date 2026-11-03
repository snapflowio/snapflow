// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package coderun

import "fmt"

type CodeToolbox interface {
	GetRunCommand(code string, argv []string) string
}

func GetToolbox(language string) (CodeToolbox, error) {
	switch language {
	case "python":
		return &pythonToolbox{}, nil
	case "javascript":
		return &javascriptToolbox{}, nil
	case "typescript":
		return &typescriptToolbox{}, nil
	default:
		return nil, fmt.Errorf("unsupported language: %s", language)
	}
}
