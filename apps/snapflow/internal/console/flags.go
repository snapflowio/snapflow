// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"encoding/json"
	"fmt"
	"io"
)

const (
	jsonFlag         = "json"
	isolationFlag    = "isolation"
	yesFlag          = "yes"
	apiURLFlag       = "api-url"
	nameFlag         = "name"
	organizationFlag = "organization"
	jsonIndent       = "  "
	jsonNoPrefix     = ""
)

func writeJSON(destination io.Writer, value any) error {
	encoder := json.NewEncoder(destination)
	encoder.SetIndent(jsonNoPrefix, jsonIndent)
	if err := encoder.Encode(value); err != nil {
		return fmt.Errorf("write JSON result: %w", err)
	}
	return nil
}
