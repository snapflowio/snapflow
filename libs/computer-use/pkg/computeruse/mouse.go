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

package computeruse

import (
	"log/slog"
	"os"
	"time"

	"github.com/go-vgo/robotgo"
	"github.com/snapflowio/computer-use/plugin"
)

const (
	pointerSettleDelay = 50 * time.Millisecond
	clickSettleDelay   = 100 * time.Millisecond
	dragStepDelay      = 2 * time.Millisecond
	dragHoldDelay      = 300 * time.Millisecond
	dragSteps          = 20
	scrollUpStep       = 1
	scrollDownStep     = -1
	scrollStepDelay    = 10
)

func (u *ComputerUse) GetMousePosition() (*plugin.MousePositionResponse, error) {
	display := os.Getenv("DISPLAY")
	slog.Debug("Reading mouse position", "display", display)

	x, y := robotgo.Location()

	return &plugin.MousePositionResponse{
		Position: plugin.Position{
			X: x,
			Y: y,
		},
	}, nil
}

func (u *ComputerUse) MoveMouse(req *plugin.MouseMoveRequest) (*plugin.MousePositionResponse, error) {
	robotgo.Move(req.X, req.Y)

	time.Sleep(pointerSettleDelay)

	actualX, actualY := robotgo.Location()

	return &plugin.MousePositionResponse{
		Position: plugin.Position{
			X: actualX,
			Y: actualY,
		},
	}, nil
}

func (u *ComputerUse) Click(req *plugin.MouseClickRequest) (*plugin.MouseClickResponse, error) {
	button, err := normalizeMouseButton(req.Button)
	if err != nil {
		return nil, err
	}
	req.Button = button
	robotgoButton := robotgoMouseButton(button)

	robotgo.Move(req.X, req.Y)
	time.Sleep(clickSettleDelay)

	robotgo.Click(robotgoButton, req.Double)

	actualX, actualY := robotgo.Location()

	return &plugin.MouseClickResponse{
		Position: plugin.Position{
			X: actualX,
			Y: actualY,
		},
	}, nil
}

func moveMouseSmoothly(startX, startY, endX, endY, steps int) {
	dx := float64(endX-startX) / float64(steps)
	dy := float64(endY-startY) / float64(steps)
	for i := 1; i <= steps; i++ {
		x := int(float64(startX) + dx*float64(i))
		y := int(float64(startY) + dy*float64(i))
		robotgo.Move(x, y)
		time.Sleep(dragStepDelay)
	}
}

func (u *ComputerUse) Drag(req *plugin.MouseDragRequest) (*plugin.MouseDragResponse, error) {
	button, err := normalizeMouseButton(req.Button)
	if err != nil {
		return nil, err
	}
	req.Button = button
	robotgoButton := robotgoMouseButton(button)

	robotgo.Move(req.StartX, req.StartY)
	time.Sleep(clickSettleDelay)

	robotgo.Click(robotgoButton, false)
	time.Sleep(clickSettleDelay)

	err = robotgo.MouseUp(robotgoButton)
	if err != nil {
		return nil, err
	}
	time.Sleep(pointerSettleDelay)

	err = robotgo.MouseDown(robotgoButton)
	if err != nil {
		return nil, err
	}
	time.Sleep(dragHoldDelay)

	moveMouseSmoothly(req.StartX, req.StartY, req.EndX, req.EndY, dragSteps)
	time.Sleep(clickSettleDelay)

	err = robotgo.MouseUp(robotgoButton)
	if err != nil {
		return nil, err
	}
	time.Sleep(pointerSettleDelay)

	actualX, actualY := robotgo.Location()

	return &plugin.MouseDragResponse{
		Position: plugin.Position{
			X: actualX,
			Y: actualY,
		},
	}, nil
}

func (u *ComputerUse) Scroll(req *plugin.MouseScrollRequest) (*plugin.ScrollResponse, error) {
	direction, err := normalizeScrollDirection(req.Direction)
	if err != nil {
		return nil, err
	}
	req.Direction = direction

	amount, err := normalizeScrollAmount(req.Amount)
	if err != nil {
		return nil, err
	}
	req.Amount = amount

	robotgo.Move(req.X, req.Y)
	time.Sleep(pointerSettleDelay)

	step := scrollDownStep
	if req.Direction == scrollDirectionUp {
		step = scrollUpStep
	}
	robotgo.ScrollSmooth(step, req.Amount, scrollStepDelay)

	return &plugin.ScrollResponse{
		Success: true,
	}, nil
}
