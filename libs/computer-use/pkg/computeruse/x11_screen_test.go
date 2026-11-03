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
	"image"
	"image/color"
	"testing"

	"github.com/jezek/xgb/xproto"
)

const (
	testDepth  = 24
	testVisual = xproto.Visualid(33)
)

func TestCopyX11PixelsDecodesBGRXIntoTarget(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 3, 2))
	data := []byte{0x00, 0x00, 0xff, 0x00, 0xff, 0x00, 0x00, 0x00}

	copyX11Pixels(img, data, image.Rect(1, 1, 3, 2))

	if got := img.RGBAAt(1, 1); got != (color.RGBA{R: 0xff, A: opaqueAlpha}) {
		t.Fatalf("pixel (1,1) = %v, want opaque red", got)
	}
	if got := img.RGBAAt(2, 1); got != (color.RGBA{B: 0xff, A: opaqueAlpha}) {
		t.Fatalf("pixel (2,1) = %v, want opaque blue", got)
	}
	if got := img.RGBAAt(0, 0); got != (color.RGBA{}) {
		t.Fatalf("pixel (0,0) = %v, want it untouched", got)
	}
}

func TestRequireCapturePixelFormat(t *testing.T) {
	trueColor := xproto.VisualInfo{
		VisualId: testVisual, Class: xproto.VisualClassTrueColor,
		RedMask: x11RedMask, GreenMask: x11GreenMask, BlueMask: x11BlueMask,
	}
	newScreen := func(order, bitsPerPixel byte, visual xproto.VisualInfo) *x11Screen {
		return &x11Screen{
			setup: &xproto.SetupInfo{
				ImageByteOrder: order,
				PixmapFormats:  []xproto.Format{{Depth: testDepth, BitsPerPixel: bitsPerPixel}},
			},
			screen: &xproto.ScreenInfo{AllowedDepths: []xproto.DepthInfo{{Depth: testDepth, Visuals: []xproto.VisualInfo{visual}}}},
		}
	}
	reply := &xproto.GetImageReply{Depth: testDepth, Visual: testVisual}
	if err := newScreen(xproto.ImageOrderLSBFirst, x11CaptureBitsPerPixel, trueColor).requireCapturePixelFormat(reply); err != nil {
		t.Fatalf("32-bit little-endian true colour rejected: %v", err)
	}
	swapped := trueColor
	swapped.RedMask, swapped.BlueMask = x11BlueMask, x11RedMask
	rejected := map[string]*x11Screen{
		"big endian":    newScreen(xproto.ImageOrderMSBFirst, x11CaptureBitsPerPixel, trueColor),
		"24 bpp":        newScreen(xproto.ImageOrderLSBFirst, testDepth, trueColor),
		"swapped masks": newScreen(xproto.ImageOrderLSBFirst, x11CaptureBitsPerPixel, swapped),
	}
	for name, screen := range rejected {
		t.Run(name, func(t *testing.T) {
			if err := screen.requireCapturePixelFormat(reply); err == nil {
				t.Fatal("unsupported pixel format accepted")
			}
		})
	}
}
