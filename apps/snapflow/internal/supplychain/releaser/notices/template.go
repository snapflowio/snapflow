// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package notices

import (
	"fmt"
	"strings"
)

const placeholder = "@@GO_MODULES@@"

func fillTemplate(template, modules string) (string, error) {
	placeholderLine := "\n" + placeholder + "\n"
	if strings.Count(template, placeholder) != 1 || !strings.Contains(template, placeholderLine) {
		return "", fmt.Errorf("template must contain exactly one %s placeholder, on its own line", placeholder)
	}
	return strings.Replace(template, placeholderLine, "\n"+modules, 1), nil
}
