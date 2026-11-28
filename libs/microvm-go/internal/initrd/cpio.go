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

package initrd

import (
	"compress/gzip"
	"fmt"
	"io"
	"path"
	"strings"
)

const (
	cpioDirectoryType   = 0o040000
	cpioRegularFileType = 0o100000
	cpioDirectoryLinks  = 2
	cpioHeaderBytes     = 110
	cpioAlignment       = 4
)

const (
	cpioMagic = "070701"
	cpioEOF   = "TRAILER!!!"
	cpioMtime = 0
)

type cpioWriter struct {
	w io.Writer
}

func newCpioGzipWriter(w io.Writer) (*cpioWriter, func() error) {
	gz := gzip.NewWriter(w)
	return &cpioWriter{w: gz}, gz.Close
}

func (w *cpioWriter) dir(name string, mode int64) error {
	name = cleanName(name)
	return w.header(name, mode|cpioDirectoryType, cpioDirectoryLinks, nil)
}

func (w *cpioWriter) file(name string, mode int64, data []byte) error {
	name = cleanName(name)
	return w.header(name, mode|cpioRegularFileType, 1, data)
}

func (w *cpioWriter) trailer() error {
	return w.header(cpioEOF, 0, 1, nil)
}

func (w *cpioWriter) header(name string, mode, nlink int64, data []byte) error {
	namesize := len(name) + 1
	filesize := len(data)
	header := fmt.Sprintf(
		"%s%08x%08x%08x%08x%08x%08x%08x%08x%08x%08x%08x%08x%08x",
		cpioMagic,
		0,
		mode,
		0,
		0,
		nlink,
		cpioMtime,
		filesize,
		0,
		0,
		0,
		0,
		namesize,
		0,
	)
	if len(header) != cpioHeaderBytes {
		return fmt.Errorf("invalid cpio header length %d", len(header))
	}
	if _, err := io.WriteString(w.w, header); err != nil {
		return err
	}
	if _, err := io.WriteString(w.w, name); err != nil {
		return err
	}
	if _, err := w.w.Write([]byte{0}); err != nil {
		return err
	}
	if err := pad(w.w, cpioHeaderBytes+namesize); err != nil {
		return err
	}
	if len(data) > 0 {
		if _, err := w.w.Write(data); err != nil {
			return err
		}
		if err := pad(w.w, filesize); err != nil {
			return err
		}
	}
	return nil
}

func cleanName(name string) string {
	name = strings.TrimPrefix(path.Clean(name), "/")
	if name == "." {
		return ""
	}
	return name
}

func pad(w io.Writer, size int) error {
	padding := (cpioAlignment - (size % cpioAlignment)) % cpioAlignment
	if padding == 0 {
		return nil
	}
	_, err := w.Write(make([]byte, padding))
	return err
}
