// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package notices

import "testing"

func TestFillTemplateReplacesPlaceholderLine(t *testing.T) {
	template := "## Go modules\n\n" + placeholder + "\n## Apache License 2.0\n"
	filled, err := fillTemplate(template, "### module v1\n\n")
	if err != nil {
		t.Fatal(err)
	}
	if want := "## Go modules\n\n### module v1\n\n## Apache License 2.0\n"; filled != want {
		t.Fatalf("filled = %q, want %q", filled, want)
	}
}

func TestFillTemplateRejectsMissingOrRepeatedPlaceholder(t *testing.T) {
	for name, template := range map[string]string{
		"missing":  "## Go modules\n\n## Apache License 2.0\n",
		"inline":   "## Go modules " + placeholder + "\n",
		"repeated": "\n" + placeholder + "\n" + placeholder + "\n",
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := fillTemplate(template, "modules"); err == nil {
				t.Fatal("template without exactly one placeholder line was accepted")
			}
		})
	}
}
