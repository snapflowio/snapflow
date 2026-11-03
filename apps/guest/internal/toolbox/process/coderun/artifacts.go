// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package coderun

import (
	"encoding/json"
	"strings"
)

const ArtifactMarker = "dtn_artifact_k39fd2:"

type rawArtifact struct {
	Type  string          `json:"type"`
	Value json.RawMessage `json:"value"`
}

func ParseArtifacts(output string) (cleanedOutput string, artifacts *CodeRunArtifacts) {
	var charts []Chart
	lines := strings.Split(output, "\n")
	filtered := make([]string, 0, len(lines))

	for _, line := range lines {
		if !strings.HasPrefix(line, ArtifactMarker) {
			filtered = append(filtered, line)
			continue
		}

		artifactPayload := strings.TrimSpace(strings.TrimPrefix(line, ArtifactMarker))
		if artifactPayload == "" {
			continue
		}

		var artifact rawArtifact
		if err := json.Unmarshal([]byte(artifactPayload), &artifact); err != nil {
			continue
		}

		if artifact.Type == "chart" && len(artifact.Value) > 0 {
			var chart Chart
			if err := json.Unmarshal(artifact.Value, &chart); err != nil {
				continue
			}
			charts = append(charts, chart)
		}
	}

	cleanedOutput = strings.Join(filtered, "\n")
	if len(charts) > 0 {
		artifacts = &CodeRunArtifacts{Charts: charts}
	}

	return cleanedOutput, artifacts
}
