// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/doctor"
	"github.com/snapflowio/snapflow/internal/console/view"
	"github.com/snapflowio/snapflow/internal/control"
)

const (
	jsonNoPrefix = ""
	jsonIndent   = "  "
)

type reporter struct {
	out   io.Writer
	theme style.Theme
}

func Report(ctx context.Context, cfg Config) error {
	if err := cfg.validate(); err != nil {
		return err
	}
	out, theme := cfg.Console.Out, cfg.Console.Theme
	fmt.Fprintln(out, view.Header(theme, text.SetupTitle, cfg.Profile))
	result, err := cfg.Setup.Run(ctx, reporter{out: out, theme: theme})
	if err != nil {
		return reportFailure(err, cfg.Profile)
	}
	if cfg.ResultJSON != nil {
		return writeResult(cfg.ResultJSON, result)
	}
	fmt.Fprintln(out, "")
	fmt.Fprintln(out, summary(theme, cfg.Profile, result))
	return nil
}

func reportFailure(err error, profile string) error {
	var coded *cli.ExitError
	if errors.As(err, &coded) {
		return err
	}
	return cli.Fail(exitCode(err), err, hintFor(err, profile))
}

func (report reporter) PhaseStarted(progress admin.SetupProgress) {
	fmt.Fprintln(report.out, report.theme.Muted.Render(text.PhaseStep(progress.Step, progress.Total))+space+
		report.theme.Title.Render(phaseTitles()[progress.Phase]))
}

func (report reporter) PhaseFinished(progress admin.SetupProgress) {
	if note := noteTexts()[progress.Note]; note != "" {
		fmt.Fprintln(report.out, report.theme.Indent.Render(report.theme.Success.Render(style.SymbolPass)+space+
			report.theme.Secondary.Render(note)))
	}
}

func (report reporter) CheckCompleted(check doctor.DiagnosticCheck) {
	fmt.Fprintln(report.out, view.Check(report.theme, check))
}

func (report reporter) AuthorizationStarted(code control.DeviceAuthorization) {
	fmt.Fprintln(report.out, report.theme.Indent.Render(text.ApprovalLine(code.VerificationURIComplete, code.UserCode)))
	fmt.Fprintln(report.out, report.theme.Indent.Render(report.theme.Muted.Render(text.ApprovalWaiting)))
}

func (report reporter) ChooseOrganization(
	ctx context.Context,
	choice control.OrganizationChoice,
) (control.Organization, error) {
	fmt.Fprintln(report.out, view.Indent(view.Organizations(report.theme, choice)))
	return choice.Active, ctx.Err()
}

func writeResult(destination io.Writer, result admin.SetupResult) error {
	encoder := json.NewEncoder(destination)
	encoder.SetIndent(jsonNoPrefix, jsonIndent)
	if err := encoder.Encode(result); err != nil {
		return fmt.Errorf("write setup result: %w", err)
	}
	return nil
}
