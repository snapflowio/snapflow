// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package manager

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"

	"github.com/hashicorp/go-hclog"
	goplugin "github.com/hashicorp/go-plugin"
	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/computer-use/plugin"
	"github.com/snapflowio/guest/internal/childreap"
)

type Plugin struct {
	ComputerUse plugin.ComputerUse
	client      *goplugin.Client
	cancel      context.CancelFunc
}

func (p *Plugin) Close() {
	p.client.Kill()
	p.cancel()
}

func Load(ctx context.Context, logger *slog.Logger, reaper *childreap.Reaper, path string) (*Plugin, error) {
	if err := requirePluginFile(path); err != nil {
		return nil, err
	}
	if failure := selfCheck(ctx, logger, reaper, path); failure != nil && failure.Kind != failurePlugin {
		return nil, fmt.Errorf("start the computer-use plugin: %w", failure)
	}
	pluginContext, cancel := context.WithCancel(context.WithoutCancel(ctx))
	client := goplugin.NewClient(&goplugin.ClientConfig{
		HandshakeConfig: plugin.Handshake(),
		Plugins:         map[string]goplugin.Plugin{guestspec.ComputerUsePluginName: &plugin.Plugin{}},
		Cmd:             exec.CommandContext(pluginContext, path),
		Logger:          hclog.NewNullLogger(),
	})
	loaded := &Plugin{client: client, cancel: cancel}
	impl, err := dispense(ctx, logger, reaper, client, path)
	if err != nil {
		loaded.Close()
		return nil, err
	}
	if _, err := impl.Initialize(); err != nil {
		loaded.Close()
		return nil, fmt.Errorf("initialize the computer-use plugin: %w", err)
	}
	loaded.ComputerUse = impl
	logger.Info("Computer-use plugin initialized")
	return loaded, nil
}

func requirePluginFile(path string) error {
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("computer-use plugin not found at %s", path)
	}
	if err != nil {
		return fmt.Errorf("inspect the computer-use plugin: %w", err)
	}
	if info.IsDir() {
		return fmt.Errorf("computer-use plugin path %s is a directory", path)
	}
	return nil
}

func dispense(ctx context.Context, logger *slog.Logger, reaper *childreap.Reaper, client *goplugin.Client, path string) (plugin.ComputerUse, error) {
	rpcClient, err := connect(ctx, client)
	if err != nil {
		if ctx.Err() != nil {
			return nil, fmt.Errorf("connect to the computer-use plugin: %w", err)
		}
		if failure := selfCheck(ctx, logger, reaper, path); failure != nil {
			return nil, fmt.Errorf("connect to the computer-use plugin: %w", failure)
		}
		return nil, fmt.Errorf("connect to the computer-use plugin: %w", err)
	}
	raw, err := rpcClient.Dispense(guestspec.ComputerUsePluginName)
	if err != nil {
		return nil, fmt.Errorf("dispense the computer-use plugin: %w", err)
	}
	impl, ok := raw.(plugin.ComputerUse)
	if !ok {
		return nil, fmt.Errorf("the computer-use plugin dispensed an unexpected %T", raw)
	}
	return impl, nil
}

type connection struct {
	protocol goplugin.ClientProtocol
	err      error
}

func connect(ctx context.Context, client *goplugin.Client) (goplugin.ClientProtocol, error) {
	connected := make(chan connection, 1)
	go func() {
		protocol, err := client.Client()
		connected <- connection{protocol: protocol, err: err}
	}()
	select {
	case result := <-connected:
		return result.protocol, result.err
	case <-ctx.Done():
		client.Kill()
		return nil, ctx.Err()
	}
}

func selfCheck(ctx context.Context, logger *slog.Logger, reaper *childreap.Reaper, path string) *Failure {
	var output bytes.Buffer
	cmd := exec.CommandContext(ctx, path, guestspec.ComputerUseSelfCheckArgument)
	cmd.Stdout = &output
	cmd.Stderr = &output
	exitCode, err := reaper.Execute(cmd)
	if err == nil && exitCode == 0 {
		return nil
	}
	logger.Debug("Computer-use plugin self-check failed", "exitCode", exitCode, "error", err, "output", output.String())
	return classifyFailure(output.String(), exitCode, err)
}
