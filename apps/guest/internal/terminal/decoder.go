// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package terminal

import (
	"bytes"
	"unicode/utf8"
)

type UTF8Decoder struct {
	buffer []byte
}

func NewUTF8Decoder() *UTF8Decoder {
	return &UTF8Decoder{
		buffer: make([]byte, 0, utf8.UTFMax),
	}
}

func (d *UTF8Decoder) Write(data []byte) string {
	data = append(d.buffer, data...)
	var output bytes.Buffer

	i := 0
	for i < len(data) {
		r, size := utf8.DecodeRune(data[i:])
		if r == utf8.RuneError {
			if size == 1 {
				remaining := len(data) - i
				if remaining < utf8.UTFMax {
					break
				}
				output.WriteRune(r)
				i++
				continue
			}
		}
		output.WriteRune(r)
		i += size
	}

	d.buffer = d.buffer[:0]
	if i < len(data) {
		d.buffer = append(d.buffer, data[i:]...)
	}

	return output.String()
}
