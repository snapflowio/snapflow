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
	"errors"
	"fmt"
	"image"
	"image/draw"

	"github.com/jezek/xgb"
	"github.com/jezek/xgb/randr"
	"github.com/jezek/xgb/xproto"
)

const (
	randrMonitorsMajor     = 1
	randrMonitorsMinor     = 5
	x11AllPlanes           = ^uint32(0)
	x11CaptureBitsPerPixel = 32
	x11BytesPerPixel       = x11CaptureBitsPerPixel / 8
	x11RedMask             = 0xff0000
	x11GreenMask           = 0x00ff00
	x11BlueMask            = 0x0000ff
	x11BlueOffset          = 0
	x11GreenOffset         = 1
	x11RedOffset           = 2
	rgbaRedOffset          = 0
	rgbaGreenOffset        = 1
	rgbaBlueOffset         = 2
	rgbaAlphaOffset        = 3
	opaqueAlpha            = 0xff
)

var errUnsupportedPixelFormat = errors.New("the X screen pixel format is not 32-bit little-endian true colour")

type x11Screen struct {
	connection *xgb.Conn
	setup      *xproto.SetupInfo
	screen     *xproto.ScreenInfo
	bounds     image.Rectangle
}

func openX11Screen() (*x11Screen, error) {
	connection, err := xgb.NewConn()
	if err != nil {
		return nil, fmt.Errorf("connect to X display: %w", err)
	}
	setup := xproto.Setup(connection)
	screen := setup.DefaultScreen(connection)
	return &x11Screen{
		connection: connection,
		setup:      setup,
		screen:     screen,
		bounds:     image.Rect(0, 0, int(screen.WidthInPixels), int(screen.HeightInPixels)),
	}, nil
}

func (s *x11Screen) close() {
	s.connection.Close()
}

func listDisplays() ([]image.Rectangle, error) {
	screen, err := openX11Screen()
	if err != nil {
		return nil, err
	}
	defer screen.close()
	return screen.monitors()
}

func captureFullScreen() (*image.RGBA, error) {
	screen, err := openX11Screen()
	if err != nil {
		return nil, err
	}
	defer screen.close()
	return screen.capture(screen.bounds)
}

func captureRegion(rect image.Rectangle) (*image.RGBA, error) {
	screen, err := openX11Screen()
	if err != nil {
		return nil, err
	}
	defer screen.close()
	return screen.capture(rect)
}

func (s *x11Screen) monitors() ([]image.Rectangle, error) {
	supported, err := s.supportsMonitors()
	if err != nil || !supported {
		return []image.Rectangle{s.bounds}, err
	}
	reply, err := randr.GetMonitors(s.connection, s.screen.Root, true).Reply()
	if err != nil {
		return nil, fmt.Errorf("read RandR monitors: %w", err)
	}
	if len(reply.Monitors) == 0 {
		return []image.Rectangle{s.bounds}, nil
	}
	displays := make([]image.Rectangle, 0, len(reply.Monitors))
	for _, monitor := range reply.Monitors {
		origin := image.Pt(int(monitor.X), int(monitor.Y))
		displays = append(displays, image.Rectangle{Min: origin, Max: origin.Add(image.Pt(int(monitor.Width), int(monitor.Height)))})
	}
	return displays, nil
}

func (s *x11Screen) randrAvailable() bool {
	return randr.Init(s.connection) == nil
}

func (s *x11Screen) supportsMonitors() (bool, error) {
	if !s.randrAvailable() {
		return false, nil
	}
	version, err := randr.QueryVersion(s.connection, randrMonitorsMajor, randrMonitorsMinor).Reply()
	if err != nil {
		return false, fmt.Errorf("query RandR version: %w", err)
	}
	return version.MajorVersion > randrMonitorsMajor ||
		(version.MajorVersion == randrMonitorsMajor && version.MinorVersion >= randrMonitorsMinor), nil
}

func (s *x11Screen) capture(rect image.Rectangle) (*image.RGBA, error) {
	img := image.NewRGBA(image.Rect(0, 0, rect.Dx(), rect.Dy()))
	draw.Draw(img, img.Bounds(), image.Black, image.Point{}, draw.Src)
	visible := rect.Intersect(s.bounds)
	if visible.Empty() {
		return img, nil
	}
	reply, err := xproto.GetImage(
		s.connection, xproto.ImageFormatZPixmap, xproto.Drawable(s.screen.Root),
		int16(visible.Min.X), int16(visible.Min.Y), uint16(visible.Dx()), uint16(visible.Dy()), x11AllPlanes,
	).Reply()
	if err != nil {
		return nil, fmt.Errorf("read X screen image %v: %w", visible, err)
	}
	if err := s.requireCapturePixelFormat(reply); err != nil {
		return nil, err
	}
	if want := visible.Dx() * visible.Dy() * x11BytesPerPixel; len(reply.Data) < want {
		return nil, fmt.Errorf("the X screen image holds %d bytes, want %d", len(reply.Data), want)
	}
	copyX11Pixels(img, reply.Data, visible.Sub(rect.Min))
	return img, nil
}

func copyX11Pixels(img *image.RGBA, data []byte, target image.Rectangle) {
	width := target.Dx()
	for row := 0; row < target.Dy(); row++ {
		for column := 0; column < width; column++ {
			source := (row*width + column) * x11BytesPerPixel
			destination := img.PixOffset(target.Min.X+column, target.Min.Y+row)
			img.Pix[destination+rgbaRedOffset] = data[source+x11RedOffset]
			img.Pix[destination+rgbaGreenOffset] = data[source+x11GreenOffset]
			img.Pix[destination+rgbaBlueOffset] = data[source+x11BlueOffset]
			img.Pix[destination+rgbaAlphaOffset] = opaqueAlpha
		}
	}
}

func (s *x11Screen) requireCapturePixelFormat(reply *xproto.GetImageReply) error {
	if s.setup.ImageByteOrder != xproto.ImageOrderLSBFirst {
		return errUnsupportedPixelFormat
	}
	if !hasPixmapFormat(s.setup.PixmapFormats, reply.Depth) {
		return errUnsupportedPixelFormat
	}
	visual, found := findVisual(s.screen, reply.Depth, reply.Visual)
	if !found || visual.Class != xproto.VisualClassTrueColor ||
		visual.RedMask != x11RedMask || visual.GreenMask != x11GreenMask || visual.BlueMask != x11BlueMask {
		return errUnsupportedPixelFormat
	}
	return nil
}

func hasPixmapFormat(formats []xproto.Format, depth byte) bool {
	for _, format := range formats {
		if format.Depth == depth && format.BitsPerPixel == x11CaptureBitsPerPixel {
			return true
		}
	}
	return false
}

func findVisual(screen *xproto.ScreenInfo, depth byte, id xproto.Visualid) (xproto.VisualInfo, bool) {
	for _, allowed := range screen.AllowedDepths {
		if allowed.Depth != depth {
			continue
		}
		for _, visual := range allowed.Visuals {
			if visual.VisualId == id {
				return visual, true
			}
		}
	}
	return xproto.VisualInfo{}, false
}
