// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package releaser

import (
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/spf13/cobra"
)

type bundleFlags struct {
	version         string
	revision        string
	builtAt         string
	architecture    string
	guestRelease    string
	outputRoot      string
	snapflow        string
	snapflowd       string
	firecracker     string
	cloudHypervisor string
	mkfsErofs       string
	kernel          string
	initrd          string
	notices         string
}

func newBundleCommand(stdout io.Writer) *cobra.Command {
	values := bundleFlags{}
	command := &cobra.Command{
		Use:   "bundle",
		Short: "Build an immutable architecture-specific Snapflow release bundle",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			bundle, err := buildBundle(values)
			if err != nil {
				return err
			}
			_, err = fmt.Fprintln(stdout, bundle)
			return err
		},
	}
	command.Flags().StringVar(&values.version, "version", "", "Snapflow release version")
	command.Flags().StringVar(&values.revision, "revision", "", "source revision")
	command.Flags().StringVar(&values.builtAt, "built-at", "", "reproducible RFC3339 build timestamp")
	command.Flags().StringVar(&values.architecture, "architecture", "", "target Go architecture")
	command.Flags().StringVar(&values.guestRelease, "guest-release", "", "digest-pinned guest release")
	command.Flags().StringVar(&values.outputRoot, "output-directory", "", "directory that receives the bundle")
	command.Flags().StringVar(&values.snapflow, "snapflow", "", "Snapflow CLI executable")
	command.Flags().StringVar(&values.snapflowd, "snapflowd", "", "Snapflow daemon executable")
	command.Flags().StringVar(&values.firecracker, "firecracker", "", "Firecracker executable")
	command.Flags().StringVar(&values.cloudHypervisor, "cloud-hypervisor", "", "Cloud Hypervisor executable")
	command.Flags().StringVar(&values.mkfsErofs, "mkfs-erofs", "", "statically linked mkfs.erofs")
	command.Flags().StringVar(&values.kernel, "kernel", "", "guest kernel")
	command.Flags().StringVar(&values.initrd, "initrd", "", "guest initrd")
	command.Flags().StringVar(&values.notices, "notices", "", "optional third-party notices")
	cli.RequireFlags(
		command,
		"version",
		"revision",
		"built-at",
		"architecture",
		"guest-release",
		"output-directory",
		"snapflow",
		"snapflowd",
		"firecracker",
		"cloud-hypervisor",
		"mkfs-erofs",
		"kernel",
		"initrd",
	)
	return command
}

func buildBundle(values bundleFlags) (string, error) {
	builtAt, err := time.Parse(time.RFC3339, strings.TrimSpace(values.builtAt))
	if err != nil {
		return "", fmt.Errorf("parse --built-at: %w", err)
	}
	return release.BuildBundle(release.BundleConfig{
		Version: values.version, Revision: values.revision,
		BuiltAt: builtAt, Architecture: values.architecture, GuestRelease: values.guestRelease,
		Inputs: release.BundleInputs{
			Snapflow: values.snapflow, Snapflowd: values.snapflowd, Firecracker: values.firecracker,
			CloudHypervisor: values.cloudHypervisor, MkfsErofs: values.mkfsErofs, Kernel: values.kernel, Initrd: values.initrd,
			Notices: values.notices,
		},
		OutputRoot: values.outputRoot,
	})
}

func newVerifyBundleCommand() *cobra.Command {
	bundlePath := ""
	outputPath := ""
	command := &cobra.Command{
		Use:   "verify-bundle",
		Short: "Safely extract and verify a candidate Snapflow release bundle",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			return release.ExtractBundleFile(bundlePath, outputPath)
		},
	}
	command.Flags().StringVar(&bundlePath, "bundle", "", "candidate Snapflow release bundle")
	command.Flags().StringVar(&outputPath, "output", "", "new extraction directory")
	cli.RequireFlags(command, "bundle", "output")
	return command
}
