// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package firecracker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/socketdial"
)

const (
	maxVMMResponseBytes        = 1 << 20
	vmmRequestTimeout          = 90 * time.Second
	serialLogDirectoryMode     = 0o755
	unsupportedEndpointMessage = "Invalid request method and/or path"
)

type client struct {
	socketPath string
	client     *http.Client
}

type apiErrorResponse struct {
	FaultMessage string `json:"fault_message"`
}

type APIError struct {
	StatusCode   int
	FaultMessage string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("status %d: %s", e.StatusCode, e.FaultMessage)
}

func newClient(socketPath string) *client {
	transport := &http.Transport{
		DialContext:       socketdial.Unix(socketPath),
		DisableKeepAlives: true,
	}
	return &client{
		socketPath: socketPath,
		client: &http.Client{
			Transport: transport,
			Timeout:   vmmRequestTimeout,
		},
	}
}

func (c *client) ConfigureAndStart(ctx context.Context, cfg hypervisor.VM) error {
	if err := c.configureSerial(ctx, cfg.SerialLogPath); err != nil {
		return err
	}
	if err := c.put(ctx, "/boot-source", toBootSource(cfg)); err != nil {
		return fmt.Errorf("configure boot source: %w", err)
	}
	if err := c.put(ctx, "/machine-config", toMachineConfiguration(cfg)); err != nil {
		return fmt.Errorf("configure machine: %w", err)
	}
	if balloonCfg := toBalloonConfig(cfg); balloonCfg != nil {
		if err := c.putOptional(ctx, "/balloon", balloonCfg); err != nil {
			return fmt.Errorf("configure balloon: %w", err)
		}
	}
	if err := c.configureDevices(ctx, cfg); err != nil {
		return err
	}
	if err := c.put(ctx, "/actions", instanceActionInfo{ActionType: "InstanceStart"}); err != nil {
		return fmt.Errorf("start instance: %w", err)
	}
	return nil
}

func (c *client) configureSerial(ctx context.Context, serialLogPath string) error {
	if serialLogPath == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(serialLogPath), serialLogDirectoryMode); err != nil {
		return fmt.Errorf("create serial log directory: %w", err)
	}
	if err := c.putOptional(ctx, "/serial", serialDevice{SerialOutPath: serialLogPath}); err != nil {
		return fmt.Errorf("configure serial: %w", err)
	}
	return nil
}

func (c *client) configureDevices(ctx context.Context, cfg hypervisor.VM) error {
	for _, driveCfg := range toDriveConfigs(cfg) {
		if err := c.put(ctx, "/drives/"+url.PathEscape(driveCfg.DriveID), driveCfg); err != nil {
			return fmt.Errorf("configure drive %s: %w", driveCfg.DriveID, err)
		}
	}
	for _, netCfg := range toNetworkInterfaces(cfg) {
		if err := c.put(ctx, "/network-interfaces/"+url.PathEscape(netCfg.IfaceID), netCfg); err != nil {
			return fmt.Errorf("configure network interface %s: %w", netCfg.IfaceID, err)
		}
	}
	if vsockCfg := toVsockConfig(cfg); vsockCfg != nil {
		if err := c.put(ctx, "/vsock", vsockCfg); err != nil {
			return fmt.Errorf("configure vsock: %w", err)
		}
	}
	return nil
}

func (c *client) put(ctx context.Context, path string, requestBody any) error {
	_, err := c.do(ctx, http.MethodPut, path, requestBody, http.StatusNoContent)
	return err
}

func (c *client) putOptional(ctx context.Context, path string, requestBody any) error {
	if err := c.put(ctx, path, requestBody); err != nil && !strings.Contains(err.Error(), unsupportedEndpointMessage) {
		return err
	}
	return nil
}

func (c *client) Pause(ctx context.Context) error {
	_, err := c.do(ctx, http.MethodPatch, "/vm", vmState{State: "Paused"}, http.StatusNoContent)
	return err
}

func (c *client) Resume(ctx context.Context) error {
	_, err := c.do(ctx, http.MethodPatch, "/vm", vmState{State: "Resumed"}, http.StatusNoContent)
	return err
}

func (c *client) Info(ctx context.Context) (hypervisor.VMInfo, error) {
	body, err := c.do(ctx, http.MethodGet, "/", nil, http.StatusOK)
	if err != nil {
		return hypervisor.VMInfo{}, err
	}
	var info instanceInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return hypervisor.VMInfo{}, fmt.Errorf("decode firecracker info: %w", err)
	}
	vmState, err := hypervisor.ParseVMState(info.State)
	if err != nil {
		return hypervisor.VMInfo{}, fmt.Errorf("decode firecracker VM state: %w", err)
	}
	return hypervisor.VMInfo{State: vmState}, nil
}

func (c *client) Snapshot(ctx context.Context, destPath string) error {
	_, err := c.do(ctx, http.MethodPut, "/snapshot/create", toSnapshotCreateParams(destPath), http.StatusNoContent)
	return err
}

func (c *client) LoadSnapshot(ctx context.Context, sourcePath string, cfg hypervisor.VM) error {
	_, err := c.do(ctx, http.MethodPut, "/snapshot/load", toSnapshotLoadParams(sourcePath, cfg), http.StatusNoContent)
	return err
}

func (c *client) do(ctx context.Context, method, path string, requestBody any, expectedStatus ...int) ([]byte, error) {
	var body io.Reader
	if requestBody != nil {
		data, err := json.Marshal(requestBody)
		if err != nil {
			return nil, fmt.Errorf("marshal request body: %w", err)
		}
		body = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, "http://localhost"+path, body)
	if err != nil {
		return nil, fmt.Errorf("create firecracker request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if requestBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("firecracker %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxVMMResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read firecracker response: %w", err)
	}
	if len(data) > maxVMMResponseBytes {
		return nil, fmt.Errorf("firecracker response exceeds %d byte limit", maxVMMResponseBytes)
	}
	for _, status := range expectedStatus {
		if resp.StatusCode == status {
			return data, nil
		}
	}
	var apiResponse apiErrorResponse
	if err := json.Unmarshal(data, &apiResponse); err == nil && apiResponse.FaultMessage != "" {
		return nil, &APIError{
			StatusCode:   resp.StatusCode,
			FaultMessage: apiResponse.FaultMessage,
		}
	}
	return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(data))
}
