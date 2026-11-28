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

package plugin

import (
	"net/rpc"
)

type RPCClient struct {
	client *rpc.Client
}

func (m *RPCClient) Initialize() (*Empty, error) {
	err := m.client.Call("Plugin.Initialize", new(any), new(Empty))
	return new(Empty), err
}

func (m *RPCClient) Start() (*Empty, error) {
	err := m.client.Call("Plugin.Start", new(any), new(Empty))
	return new(Empty), err
}

func (m *RPCClient) Stop() (*Empty, error) {
	err := m.client.Call("Plugin.Stop", new(any), new(Empty))
	return new(Empty), err
}

func (m *RPCClient) GetProcessStatus() (map[string]ProcessStatus, error) {
	resp := map[string]ProcessStatus{}
	err := m.client.Call("Plugin.GetProcessStatus", new(any), &resp)
	return resp, err
}

func (m *RPCClient) IsProcessRunning(req *ProcessRequest) (bool, error) {
	var resp bool
	err := m.client.Call("Plugin.IsProcessRunning", req, &resp)
	return resp, err
}

func (m *RPCClient) RestartProcess(req *ProcessRequest) (*Empty, error) {
	err := m.client.Call("Plugin.RestartProcess", req, new(Empty))
	return new(Empty), err
}

func (m *RPCClient) GetProcessLogs(req *ProcessRequest) (string, error) {
	var resp string
	err := m.client.Call("Plugin.GetProcessLogs", req, &resp)
	return resp, err
}

func (m *RPCClient) GetProcessErrors(req *ProcessRequest) (string, error) {
	var resp string
	err := m.client.Call("Plugin.GetProcessErrors", req, &resp)
	return resp, err
}

func (m *RPCClient) TakeScreenshot(request *ScreenshotRequest) (*ScreenshotResponse, error) {
	var resp ScreenshotResponse
	err := m.client.Call("Plugin.TakeScreenshot", request, &resp)
	return &resp, err
}

func (m *RPCClient) TakeRegionScreenshot(request *RegionScreenshotRequest) (*ScreenshotResponse, error) {
	var resp ScreenshotResponse
	err := m.client.Call("Plugin.TakeRegionScreenshot", request, &resp)
	return &resp, err
}

func (m *RPCClient) TakeCompressedScreenshot(request *CompressedScreenshotRequest) (*ScreenshotResponse, error) {
	var resp ScreenshotResponse
	err := m.client.Call("Plugin.TakeCompressedScreenshot", request, &resp)
	return &resp, err
}

func (m *RPCClient) TakeCompressedRegionScreenshot(request *CompressedRegionScreenshotRequest) (*ScreenshotResponse, error) {
	var resp ScreenshotResponse
	err := m.client.Call("Plugin.TakeCompressedRegionScreenshot", request, &resp)
	return &resp, err
}

func (m *RPCClient) GetMousePosition() (*MousePositionResponse, error) {
	var resp MousePositionResponse
	err := m.client.Call("Plugin.GetMousePosition", new(any), &resp)
	return &resp, err
}

func (m *RPCClient) MoveMouse(request *MouseMoveRequest) (*MousePositionResponse, error) {
	var resp MousePositionResponse
	err := m.client.Call("Plugin.MoveMouse", request, &resp)
	return &resp, err
}

func (m *RPCClient) Click(request *MouseClickRequest) (*MouseClickResponse, error) {
	var resp MouseClickResponse
	err := m.client.Call("Plugin.Click", request, &resp)
	return &resp, err
}

func (m *RPCClient) Drag(request *MouseDragRequest) (*MouseDragResponse, error) {
	var resp MouseDragResponse
	err := m.client.Call("Plugin.Drag", request, &resp)
	return &resp, err
}

func (m *RPCClient) Scroll(request *MouseScrollRequest) (*ScrollResponse, error) {
	var resp ScrollResponse
	err := m.client.Call("Plugin.Scroll", request, &resp)
	return &resp, err
}

func (m *RPCClient) TypeText(request *KeyboardTypeRequest) (*Empty, error) {
	err := m.client.Call("Plugin.TypeText", request, new(Empty))
	return new(Empty), err
}

func (m *RPCClient) PressKey(request *KeyboardPressRequest) (*Empty, error) {
	err := m.client.Call("Plugin.PressKey", request, new(Empty))
	return new(Empty), err
}

func (m *RPCClient) PressHotkey(request *KeyboardHotkeyRequest) (*Empty, error) {
	err := m.client.Call("Plugin.PressHotkey", request, new(Empty))
	return new(Empty), err
}

func (m *RPCClient) GetDisplayInfo() (*DisplayInfoResponse, error) {
	var resp DisplayInfoResponse
	err := m.client.Call("Plugin.GetDisplayInfo", new(any), &resp)
	return &resp, err
}

func (m *RPCClient) GetWindows() (*WindowsResponse, error) {
	var resp WindowsResponse
	err := m.client.Call("Plugin.GetWindows", new(any), &resp)
	return &resp, err
}

func (m *RPCClient) GetStatus() (*ComputerUseStatusResponse, error) {
	var resp ComputerUseStatusResponse
	err := m.client.Call("Plugin.GetStatus", new(any), &resp)
	return &resp, err
}

func (m *RPCClient) GetAccessibilityTree(request *GetAccessibilityTreeRequest) (*AccessibilityTreeResponse, error) {
	var resp AccessibilityTreeResponse
	err := m.client.Call("Plugin.GetAccessibilityTree", request, &resp)
	return &resp, err
}

func (m *RPCClient) FindAccessibilityNodes(request *FindAccessibilityNodesRequest) (*AccessibilityNodesResponse, error) {
	var resp AccessibilityNodesResponse
	err := m.client.Call("Plugin.FindAccessibilityNodes", request, &resp)
	return &resp, err
}

func (m *RPCClient) FocusAccessibilityNode(request *AccessibilityNodeRequest) (*Empty, error) {
	err := m.client.Call("Plugin.FocusAccessibilityNode", request, new(Empty))
	return new(Empty), err
}

func (m *RPCClient) InvokeAccessibilityNode(request *AccessibilityInvokeRequest) (*Empty, error) {
	err := m.client.Call("Plugin.InvokeAccessibilityNode", request, new(Empty))
	return new(Empty), err
}

func (m *RPCClient) SetAccessibilityNodeValue(request *AccessibilitySetValueRequest) (*Empty, error) {
	err := m.client.Call("Plugin.SetAccessibilityNodeValue", request, new(Empty))
	return new(Empty), err
}
