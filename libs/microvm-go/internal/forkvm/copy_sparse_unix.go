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

//go:build darwin || linux

package forkvm

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"

	"golang.org/x/sys/unix"
)

func copyRegularFileSparse(srcPath, dstPath string, perms fs.FileMode) (retErr error) {
	src, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer src.Close()

	info, err := src.Stat()
	if err != nil {
		return fmt.Errorf("stat source file: %w", err)
	}
	dst, err := os.OpenFile(dstPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, perms)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := dst.Close(); retErr == nil && cerr != nil {
			retErr = cerr
		}
		if retErr != nil {
			if removeErr := os.Remove(dstPath); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
				retErr = errors.Join(retErr, fmt.Errorf("remove incomplete destination: %w", removeErr))
			}
		}
	}()

	size := info.Size()
	if err := unix.Ftruncate(int(dst.Fd()), size); err != nil {
		return fmt.Errorf("truncate destination file: %w", err)
	}
	return copySparseExtents(int(src.Fd()), int(dst.Fd()), size)
}

func copySparseExtents(srcFD, dstFD int, size int64) error {
	for offset := int64(0); offset < size; {
		dataStart, dataEnd, done, err := nextDataExtent(srcFD, offset, size)
		if err != nil || done {
			return err
		}
		if dataEnd > dataStart {
			if err := copyExtent(srcFD, dstFD, dataStart, dataEnd-dataStart); err != nil {
				return err
			}
		}
		offset = dataEnd
	}
	return nil
}

func nextDataExtent(fd int, offset, size int64) (int64, int64, bool, error) {
	dataStart, err := unix.Seek(fd, offset, unix.SEEK_DATA)
	if errors.Is(err, unix.ENXIO) {
		return 0, 0, true, nil
	}
	if err != nil {
		return 0, 0, false, sparseSeekError("seek data", err)
	}
	dataEnd, err := unix.Seek(fd, dataStart, unix.SEEK_HOLE)
	switch {
	case errors.Is(err, unix.ENXIO):
		dataEnd = size
	case err != nil:
		return 0, 0, false, sparseSeekError("seek hole", err)
	}
	dataEnd = min(dataEnd, size)
	if dataEnd < dataStart {
		return 0, 0, false, fmt.Errorf("invalid sparse extent %d..%d", dataStart, dataEnd)
	}
	return dataStart, dataEnd, false, nil
}

func sparseSeekError(operation string, err error) error {
	if sparseUnsupported(err) {
		return fmt.Errorf("%w: %w", ErrSparseUnsupported, err)
	}
	return fmt.Errorf("%s: %w", operation, err)
}

func copyExtent(srcFD, dstFD int, offset, length int64) error {
	const chunkSize = 1 << 20
	buf := make([]byte, chunkSize)
	for remaining := length; remaining > 0; {
		size := int64(len(buf))
		if remaining < size {
			size = remaining
		}
		n, err := unix.Pread(srcFD, buf[:int(size)], offset)
		if err != nil {
			return fmt.Errorf("read sparse extent: %w", err)
		}
		if n == 0 {
			return io.ErrUnexpectedEOF
		}
		written := 0
		for written < n {
			wn, err := unix.Pwrite(dstFD, buf[written:n], offset+int64(written))
			if err != nil {
				return fmt.Errorf("write sparse extent: %w", err)
			}
			if wn == 0 {
				return io.ErrShortWrite
			}
			written += wn
		}
		offset += int64(n)
		remaining -= int64(n)
	}
	return nil
}

func sparseUnsupported(err error) bool {
	return errors.Is(err, unix.EINVAL) ||
		errors.Is(err, unix.ENOTSUP) ||
		errors.Is(err, unix.EOPNOTSUPP)
}
