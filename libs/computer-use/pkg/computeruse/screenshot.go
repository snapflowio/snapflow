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
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"log/slog"
	"os"

	"github.com/go-vgo/robotgo"
	"github.com/snapflowio/computer-use/plugin"
)

func validateScreenshotRegion(width, height int) error {
	if width <= 0 || height <= 0 {
		return fmt.Errorf("invalid screenshot region: width and height must be greater than zero")
	}

	return nil
}

const (
	cursorArmLength  = 20
	cursorOutline    = 1
	cursorCenterSize = 2
	cursorOpaque     = 255
)

func cursorColors() (outline, line, center color.RGBA) {
	return color.RGBA{R: cursorOpaque, G: cursorOpaque, B: cursorOpaque, A: cursorOpaque},
		color.RGBA{A: cursorOpaque},
		color.RGBA{R: cursorOpaque, A: cursorOpaque}
}

func drawCursor(img *image.RGBA, x, y int) {
	outline, line, center := cursorColors()
	fillCross(img, x, y, cursorOutline, outline)
	fillCross(img, x, y, 0, line)
	fillSquare(img, image.Rect(x-cursorCenterSize, y-cursorCenterSize, x+cursorCenterSize+1, y+cursorCenterSize+1), center)
}

func fillCross(img *image.RGBA, x, y, thickness int, fill color.RGBA) {
	fillSquare(img, image.Rect(x-cursorArmLength, y-thickness, x+cursorArmLength+1, y+thickness+1), fill)
	fillSquare(img, image.Rect(x-thickness, y-cursorArmLength, x+thickness+1, y+cursorArmLength+1), fill)
}

func fillSquare(img *image.RGBA, area image.Rectangle, fill color.RGBA) {
	draw.Draw(img, area.Intersect(img.Bounds()), image.NewUniform(fill), image.Point{}, draw.Src)
}

func (u *ComputerUse) TakeScreenshot(req *plugin.ScreenshotRequest) (*plugin.ScreenshotResponse, error) {
	display := os.Getenv("DISPLAY")
	slog.Debug("Taking screenshot", "display", display)

	rgbaImg, err := captureFullScreen()
	if err != nil {
		return nil, fmt.Errorf("capture screen: %w", err)
	}

	mouseX, mouseY := 0, 0
	if req.ShowCursor {
		mouseX, mouseY = robotgo.Location()
		drawCursor(rgbaImg, mouseX, mouseY)
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, rgbaImg); err != nil {
		return nil, err
	}

	base64Str := base64.StdEncoding.EncodeToString(buf.Bytes())

	response := &plugin.ScreenshotResponse{
		Screenshot: base64Str,
		CursorPosition: &plugin.Position{
			X: mouseX,
			Y: mouseY,
		},
	}

	if req.ShowCursor {
		response.CursorPosition = &plugin.Position{
			X: mouseX,
			Y: mouseY,
		}
	}

	return response, nil
}

func (u *ComputerUse) TakeRegionScreenshot(req *plugin.RegionScreenshotRequest) (*plugin.ScreenshotResponse, error) {
	display := os.Getenv("DISPLAY")
	slog.Debug("Taking region screenshot", "display", display)

	if err := validateScreenshotRegion(req.Width, req.Height); err != nil {
		return nil, err
	}

	rect := image.Rect(req.X, req.Y, req.X+req.Width, req.Y+req.Height)
	rgbaImg, err := captureRegion(rect)
	if err != nil {
		return nil, fmt.Errorf("failed to capture screenshot region x=%d y=%d width=%d height=%d: %w", req.X, req.Y, req.Width, req.Height, err)
	}

	mouseX, mouseY := 0, 0
	if req.ShowCursor {
		absoluteMouseX, absoluteMouseY := robotgo.Location()
		mouseX = absoluteMouseX - req.X
		mouseY = absoluteMouseY - req.Y

		if mouseX >= 0 && mouseX < req.Width && mouseY >= 0 && mouseY < req.Height {
			drawCursor(rgbaImg, mouseX, mouseY)
		}
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, rgbaImg); err != nil {
		return nil, err
	}

	base64Str := base64.StdEncoding.EncodeToString(buf.Bytes())

	response := &plugin.ScreenshotResponse{
		Screenshot: base64Str,
		CursorPosition: &plugin.Position{
			X: mouseX + req.X,
			Y: mouseY + req.Y,
		},
	}

	if req.ShowCursor {
		response.CursorPosition = &plugin.Position{
			X: mouseX + req.X,
			Y: mouseY + req.Y,
		}
	}

	return response, nil
}
