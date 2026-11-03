// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package releaser

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/tuf"
	"github.com/spf13/cobra"
)

const (
	repositoryFlag   = "repository"
	snapshotKeyFlag  = "snapshot-key"
	timestampKeyFlag = "timestamp-key"
)

type pathsFlag []string

func (values *pathsFlag) String() string { return strings.Join(*values, ",") }

func (values *pathsFlag) Set(value string) error {
	if strings.TrimSpace(value) == "" {
		return errors.New("path cannot be empty")
	}
	*values = append(*values, value)
	return nil
}

func (pathsFlag) Type() string { return "path" }

type assignmentsFlag map[string]string

func (values assignmentsFlag) String() string {
	pairs := make([]string, 0, len(values))
	for name, value := range values {
		pairs = append(pairs, name+"="+value)
	}
	return strings.Join(pairs, ",")
}

func (values assignmentsFlag) Set(value string) error {
	name, path, found := strings.Cut(value, "=")
	if !found || strings.TrimSpace(name) == "" || strings.TrimSpace(path) == "" {
		return errors.New("expected ROLE=PATH")
	}
	if _, exists := values[name]; exists {
		return fmt.Errorf("role %s is repeated", name)
	}
	values[name] = path
	return nil
}

func (assignmentsFlag) Type() string { return "role=path" }

type onlineKeyFlags struct {
	snapshot  string
	timestamp string
}

func (flags *onlineKeyFlags) register(command *cobra.Command) {
	command.Flags().StringVar(&flags.snapshot, snapshotKeyFlag, "", "snapshot role private key")
	command.Flags().StringVar(&flags.timestamp, timestampKeyFlag, "", "timestamp role private key")
}

func newTUFCommand(stdout io.Writer) *cobra.Command {
	command := &cobra.Command{
		Use:   "tuf",
		Short: "Administer the TUF release repository",
		Args:  cobra.NoArgs,
	}
	command.AddCommand(
		newTUFInitializeCommand(),
		newTUFPublishCommand(),
		newTUFPromoteCommand(),
		newTUFRefreshCommand(),
		newTUFCheckExpiryCommand(stdout),
		newTUFGenerateKeyCommand(),
		newTUFGenerateRootKeysCommand(),
		newTUFRotateRootCommand(),
		newTUFResignCommand(),
	)
	return command
}

func newTUFInitializeCommand() *cobra.Command {
	repositoryRoot, keyRoot, policyName := "", "", ""
	command := &cobra.Command{
		Use:   "init",
		Short: "Create a release repository and its private keys in an offline ceremony",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			policy, err := tuf.ParsePolicy(policyName)
			if err != nil {
				return err
			}
			return tuf.Initialize(tuf.InitializeConfig{
				RepositoryRoot: repositoryRoot, PrivateKeyRoot: keyRoot, Policy: policy, Now: time.Now(),
			})
		},
	}
	command.Flags().StringVar(&repositoryRoot, repositoryFlag, "", "new public repository directory")
	command.Flags().StringVar(&keyRoot, "private-keys", "", "new private key directory")
	command.Flags().StringVar(&policyName, "policy", "", "repository policy: local or production")
	cli.RequireFlags(command, repositoryFlag, "private-keys", "policy")
	return command
}

func newTUFPublishCommand() *cobra.Command {
	repositoryRoot, channelName := "", ""
	bundles, roleKeys := pathsFlag{}, pathsFlag{}
	keys := onlineKeyFlags{}
	command := &cobra.Command{
		Use:   "publish",
		Short: "Point a channel at the release carried by the given bundles",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			channel, err := tuf.ParseChannel(channelName)
			if err != nil {
				return err
			}
			return tuf.Publish(tuf.PublishConfig{
				RepositoryRoot: repositoryRoot, Channel: channel, Bundles: bundles, RoleKeys: roleKeys,
				SnapshotKey: keys.snapshot, TimestampKey: keys.timestamp, Now: time.Now(),
			})
		},
	}
	command.Flags().StringVar(&repositoryRoot, repositoryFlag, "", "public repository directory")
	command.Flags().StringVar(&channelName, "channel", "", "channel to publish: beta or stable")
	command.Flags().Var(&bundles, "bundle", "release bundle; repeat once per architecture")
	command.Flags().Var(&roleKeys, "role-key", "channel role private key")
	keys.register(command)
	cli.RequireFlags(command, repositoryFlag, "channel", "bundle", "role-key", snapshotKeyFlag, timestampKeyFlag)
	return command
}

func newTUFPromoteCommand() *cobra.Command {
	repositoryRoot, from, to, version := "", "", "", ""
	roleKeys := pathsFlag{}
	keys := onlineKeyFlags{}
	command := &cobra.Command{
		Use:   "promote",
		Short: "Point one channel at a release another channel already offers",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			source, err := tuf.ParseChannel(from)
			if err != nil {
				return err
			}
			destination, err := tuf.ParseChannel(to)
			if err != nil {
				return err
			}
			return tuf.Promote(tuf.PromoteConfig{
				RepositoryRoot: repositoryRoot, From: source, To: destination, Version: version,
				RoleKeys: roleKeys, SnapshotKey: keys.snapshot, TimestampKey: keys.timestamp, Now: time.Now(),
			})
		},
	}
	command.Flags().StringVar(&repositoryRoot, repositoryFlag, "", "public repository directory")
	command.Flags().StringVar(&from, "from", "", "channel that already offers the release")
	command.Flags().StringVar(&to, "to", "", "channel to promote into")
	command.Flags().StringVar(&version, "version", "", "release version to promote")
	command.Flags().Var(&roleKeys, "role-key", "destination channel role private key")
	keys.register(command)
	cli.RequireFlags(command, repositoryFlag, "from", "to", "version", "role-key", snapshotKeyFlag, timestampKeyFlag)
	return command
}

func newTUFRefreshCommand() *cobra.Command {
	repositoryRoot := ""
	channelKeys := assignmentsFlag{}
	keys := onlineKeyFlags{}
	command := &cobra.Command{
		Use:   "refresh",
		Short: "Re-sign the online metadata before it expires",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			channels := make(map[tuf.Channel]string, len(channelKeys))
			for name, path := range channelKeys {
				channel, err := tuf.ParseChannel(name)
				if err != nil {
					return err
				}
				channels[channel] = path
			}
			return tuf.Refresh(tuf.RefreshConfig{
				RepositoryRoot: repositoryRoot, ChannelKeys: channels,
				SnapshotKey: keys.snapshot, TimestampKey: keys.timestamp, Now: time.Now(),
			})
		},
	}
	command.Flags().StringVar(&repositoryRoot, repositoryFlag, "", "public repository directory")
	command.Flags().Var(channelKeys, "channel-key", "online channel key to keep fresh, as CHANNEL=PATH")
	keys.register(command)
	cli.RequireFlags(command, repositoryFlag, snapshotKeyFlag, timestampKeyFlag)
	return command
}

func newTUFCheckExpiryCommand(stdout io.Writer) *cobra.Command {
	repositoryRoot := ""
	within := time.Duration(0)
	command := &cobra.Command{
		Use:   "check-expiry",
		Short: "Fail when signed metadata expires within the given window",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			roles, err := tuf.CheckExpiry(tuf.ExpiryConfig{RepositoryRoot: repositoryRoot, Within: within, Now: time.Now()})
			if roles != nil {
				encoder := json.NewEncoder(stdout)
				encoder.SetIndent("", "  ")
				if encodeErr := encoder.Encode(roles); encodeErr != nil {
					return errors.Join(err, encodeErr)
				}
			}
			return err
		},
	}
	command.Flags().StringVar(&repositoryRoot, repositoryFlag, "", "public repository directory")
	command.Flags().DurationVar(&within, "within", 0, "warning window, for example 720h")
	cli.RequireFlags(command, repositoryFlag, "within")
	return command
}

func newTUFGenerateKeyCommand() *cobra.Command {
	output := ""
	command := &cobra.Command{
		Use:   "generate-key",
		Short: "Generate one Ed25519 signing key",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			return tuf.GenerateKey(output)
		},
	}
	command.Flags().StringVar(&output, "output", "", "new private key file")
	cli.RequireFlags(command, "output")
	return command
}

func newTUFGenerateRootKeysCommand() *cobra.Command {
	output := ""
	command := &cobra.Command{
		Use:   "generate-root-keys",
		Short: "Generate a new offline root key quorum",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			return tuf.GenerateRootKeys(output)
		},
	}
	command.Flags().StringVar(&output, "output", "", "new root key directory")
	cli.RequireFlags(command, "output")
	return command
}

func newTUFRotateRootCommand() *cobra.Command {
	repositoryRoot := ""
	currentKeys, newKeys := pathsFlag{}, pathsFlag{}
	command := &cobra.Command{
		Use:   "rotate-root",
		Short: "Replace the root key quorum with signatures from both quorums",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			return tuf.RotateRoot(tuf.RotateRootConfig{
				RepositoryRoot: repositoryRoot, CurrentKeys: currentKeys, NewKeys: newKeys, Now: time.Now(),
			})
		},
	}
	command.Flags().StringVar(&repositoryRoot, repositoryFlag, "", "public repository directory")
	command.Flags().Var(&currentKeys, "current-root-key", "current root key; repeat to meet its threshold")
	command.Flags().Var(&newKeys, "new-root-key", "new root key; repeat for each key")
	cli.RequireFlags(command, repositoryFlag, "current-root-key", "new-root-key")
	return command
}

func newTUFResignCommand() *cobra.Command {
	repositoryRoot, role := "", ""
	signers := pathsFlag{}
	replacements := assignmentsFlag{}
	keys := onlineKeyFlags{}
	command := &cobra.Command{
		Use:   "resign",
		Short: "Re-sign root or targets metadata, optionally replacing delegated keys",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			return tuf.Resign(tuf.ResignConfig{
				RepositoryRoot: repositoryRoot, Role: role, Keys: signers, Replace: replacements,
				SnapshotKey: keys.snapshot, TimestampKey: keys.timestamp, Now: time.Now(),
			})
		},
	}
	command.Flags().StringVar(&repositoryRoot, repositoryFlag, "", "public repository directory")
	command.Flags().StringVar(&role, "role", "", "role to re-sign: root or targets")
	command.Flags().Var(&signers, "key", "signing key for the role; repeat to meet its threshold")
	command.Flags().Var(replacements, "replace", "replace a delegated key, as ROLE=NEW_PRIVATE_KEY")
	keys.register(command)
	cli.RequireFlags(command, repositoryFlag, "role", "key")
	return command
}
