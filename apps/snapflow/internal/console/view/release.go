// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"strconv"

	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/install"
	bundle "github.com/snapflowio/snapflow/internal/release"
)

type CollectedGarbage struct {
	Removed []string `json:"removed"`
}

func ReleaseVerified(theme style.Theme, verified bundle.VerifiedRelease) string {
	return Lines(
		Success(theme, text.ReleaseVerifiedTitle),
		Row(theme, text.LabelRelease, theme.Value.Render(
			verified.Manifest.Version)),
		Row(theme, text.LabelDigest, theme.Muted.Render(verified.BundleDigest)),
	)
}

func ReleaseStatus(theme style.Theme, status install.Status) string {
	lines := []string{
		Row(theme, text.LabelActive, releaseRecord(theme, status.Journal.Active)),
		Row(theme, text.LabelPrevious, releaseRecord(theme, status.Journal.Previous)),
		Row(theme, text.LabelStaging, theme.Value.Render(strconv.Itoa(len(status.Staging)))),
	}
	if status.VerificationError != "" {
		return Lines(append(lines, Failure(theme, status.VerificationError, ""))...)
	}
	return Lines(append(lines, Success(theme, text.ReleaseVerifiedTitle))...)
}

func ReleaseGarbage(theme style.Theme, garbage CollectedGarbage) string {
	lines := []string{Success(theme, text.ReleaseGarbageRemoved(len(garbage.Removed)))}
	for _, path := range garbage.Removed {
		lines = append(lines, theme.Indent.Render(theme.Muted.Render(path)))
	}
	return Lines(lines...)
}

func ReleaseReset(theme style.Theme, reset install.ResetResult) string {
	lines := []string{Success(theme, text.ReleaseResetDone)}
	for _, path := range reset.Removed {
		lines = append(lines, theme.Indent.Render(theme.Muted.Render(path)))
	}
	return Lines(lines...)
}

func ReleaseInstalled(theme style.Theme, record install.ReleaseRecord) string {
	return Lines(
		Success(theme, text.ReleaseInstalledTitle),
		Row(theme, text.LabelRelease, theme.Value.Render(record.Version)),
	)
}

func releaseRecord(theme style.Theme, record *install.ReleaseRecord) string {
	if record == nil {
		return theme.Muted.Render(text.ReleaseNone)
	}
	return theme.Value.Render(record.Version)
}
