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
	"image/jpeg"
	"image/png"

	"github.com/go-vgo/robotgo"
	"github.com/snapflowio/computer-use/plugin"
)

type ImageCompressionParams struct {
	Format  string
	Quality int
	Scale   float64
}

func encodeImageWithCompression(img *image.RGBA, params ImageCompressionParams) ([]byte, error) {
	var buf bytes.Buffer

	switch params.Format {
	case "jpeg":
		var scaledImg image.Image = img
		if params.Scale != 1.0 {
			scaledImg = scaleImage(img, params.Scale)
		}
		err := jpeg.Encode(&buf, scaledImg, &jpeg.Options{Quality: params.Quality})
		if err != nil {
			return nil, err
		}
	case "png":
		var scaledImg image.Image = img
		if params.Scale != 1.0 {
			scaledImg = scaleImage(img, params.Scale)
		}
		err := png.Encode(&buf, scaledImg)
		if err != nil {
			return nil, err
		}
	default:
		err := png.Encode(&buf, img)
		if err != nil {
			return nil, err
		}
	}

	return buf.Bytes(), nil
}

func scaleImage(img *image.RGBA, scale float64) image.Image {
	if scale == 1.0 {
		return img
	}

	oldBounds := img.Bounds()
	if oldBounds.Dx() <= 0 || oldBounds.Dy() <= 0 {
		return img
	}

	newWidth := int(float64(oldBounds.Dx()) * scale)
	newHeight := int(float64(oldBounds.Dy()) * scale)
	if newWidth < 1 {
		newWidth = 1
	}
	if newHeight < 1 {
		newHeight = 1
	}

	scaledImg := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))

	for y := 0; y < newHeight; y++ {
		for x := 0; x < newWidth; x++ {
			oldX := int(float64(x) / scale)
			oldY := int(float64(y) / scale)
			if oldX < oldBounds.Dx() && oldY < oldBounds.Dy() {
				scaledImg.Set(x, y, img.At(oldX, oldY))
			}
		}
	}

	return scaledImg
}

func (u *ComputerUse) TakeCompressedScreenshot(req *plugin.CompressedScreenshotRequest) (*plugin.ScreenshotResponse, error) {
	params := ImageCompressionParams{
		Format:  req.Format,
		Quality: req.Quality,
		Scale:   req.Scale,
	}

	rgbaImg, err := captureFullScreen()
	if err != nil {
		return nil, fmt.Errorf("capture screen: %w", err)
	}

	mouseX, mouseY := 0, 0
	if req.ShowCursor {
		mouseX, mouseY = robotgo.Location()
		drawCursor(rgbaImg, mouseX, mouseY)
	}

	imageData, err := encodeImageWithCompression(rgbaImg, params)
	if err != nil {
		return nil, err
	}

	base64Str := base64.StdEncoding.EncodeToString(imageData)

	response := &plugin.ScreenshotResponse{
		Screenshot: base64Str,
		SizeBytes:  len(imageData),
	}

	if req.ShowCursor {
		response.CursorPosition = &plugin.Position{
			X: int(float64(mouseX) * params.Scale),
			Y: int(float64(mouseY) * params.Scale),
		}
	}

	return response, nil
}

func (u *ComputerUse) TakeCompressedRegionScreenshot(req *plugin.CompressedRegionScreenshotRequest) (*plugin.ScreenshotResponse, error) {
	params := ImageCompressionParams{
		Format:  req.Format,
		Quality: req.Quality,
		Scale:   req.Scale,
	}

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

	imageData, err := encodeImageWithCompression(rgbaImg, params)
	if err != nil {
		return nil, err
	}

	base64Str := base64.StdEncoding.EncodeToString(imageData)

	response := &plugin.ScreenshotResponse{
		Screenshot: base64Str,
		SizeBytes:  len(imageData),
	}

	if req.ShowCursor {
		response.CursorPosition = &plugin.Position{
			X: req.X + int(float64(mouseX)*params.Scale),
			Y: req.Y + int(float64(mouseY)*params.Scale),
		}
	}

	return response, nil
}

func (u *ComputerUse) GetDisplayInfo() (*plugin.DisplayInfoResponse, error) {
	monitors, err := listDisplays()
	if err != nil {
		return nil, fmt.Errorf("list displays: %w", err)
	}
	displays := make([]plugin.DisplayInfo, len(monitors))
	for i, bounds := range monitors {
		displays[i] = plugin.DisplayInfo{
			ID: i,
			Position: plugin.Position{
				X: bounds.Min.X,
				Y: bounds.Min.Y,
			},
			Size: plugin.Size{
				Width:  bounds.Dx(),
				Height: bounds.Dy(),
			},
			IsActive: true,
		}
	}

	return &plugin.DisplayInfoResponse{
		Displays: displays,
	}, nil
}
