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

	goplugin "github.com/hashicorp/go-plugin"
	"github.com/snapflowio/common-go/pkg/guestspec"
)

type Lifecycle interface {
	Initialize() (*Empty, error)
	Start() (*Empty, error)
	Stop() (*Empty, error)
	GetStatus() (*ComputerUseStatusResponse, error)
}

type Processes interface {
	GetProcessStatus() (map[string]ProcessStatus, error)
	IsProcessRunning(req *ProcessRequest) (bool, error)
	RestartProcess(req *ProcessRequest) (*Empty, error)
	GetProcessLogs(req *ProcessRequest) (string, error)
	GetProcessErrors(req *ProcessRequest) (string, error)
}

type Screen interface {
	TakeScreenshot(req *ScreenshotRequest) (*ScreenshotResponse, error)
	TakeRegionScreenshot(req *RegionScreenshotRequest) (*ScreenshotResponse, error)
	TakeCompressedScreenshot(req *CompressedScreenshotRequest) (*ScreenshotResponse, error)
	TakeCompressedRegionScreenshot(req *CompressedRegionScreenshotRequest) (*ScreenshotResponse, error)
	GetDisplayInfo() (*DisplayInfoResponse, error)
	GetWindows() (*WindowsResponse, error)
}

type Input interface {
	GetMousePosition() (*MousePositionResponse, error)
	MoveMouse(req *MouseMoveRequest) (*MousePositionResponse, error)
	Click(req *MouseClickRequest) (*MouseClickResponse, error)
	Drag(req *MouseDragRequest) (*MouseDragResponse, error)
	Scroll(req *MouseScrollRequest) (*ScrollResponse, error)
	TypeText(req *KeyboardTypeRequest) (*Empty, error)
	PressKey(req *KeyboardPressRequest) (*Empty, error)
	PressHotkey(req *KeyboardHotkeyRequest) (*Empty, error)
}

type Accessibility interface {
	GetAccessibilityTree(req *GetAccessibilityTreeRequest) (*AccessibilityTreeResponse, error)
	FindAccessibilityNodes(req *FindAccessibilityNodesRequest) (*AccessibilityNodesResponse, error)
	FocusAccessibilityNode(req *AccessibilityNodeRequest) (*Empty, error)
	InvokeAccessibilityNode(req *AccessibilityInvokeRequest) (*Empty, error)
	SetAccessibilityNodeValue(req *AccessibilitySetValueRequest) (*Empty, error)
}

type ComputerUse interface {
	Lifecycle
	Processes
	Screen
	Input
	Accessibility
}

func Handshake() goplugin.HandshakeConfig {
	return goplugin.HandshakeConfig{
		ProtocolVersion:  guestspec.ComputerUseProtocolVersion,
		MagicCookieKey:   guestspec.ComputerUseMagicCookieKey,
		MagicCookieValue: guestspec.ComputerUseMagicCookieValue,
	}
}

type Plugin struct {
	Impl ComputerUse
}

func (p *Plugin) Server(*goplugin.MuxBroker) (any, error) {
	return &RPCServer{Impl: p.Impl}, nil
}

func (p *Plugin) Client(broker *goplugin.MuxBroker, client *rpc.Client) (any, error) {
	return &RPCClient{client: client}, nil
}
