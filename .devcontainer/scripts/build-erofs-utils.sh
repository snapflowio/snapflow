#!/bin/sh
set -eu

EROFS_UTILS_VERSION=1.9.4
EROFS_UTILS_SHA256=7d135aa2550326a5acf20f53c518aea5a8900015ce50700044e40f818c31dd80
EROFS_UTILS_URL="https://github.com/erofs/erofs-utils/archive/refs/tags/v${EROFS_UTILS_VERSION}.tar.gz"

output_dir=${1:?output directory is required}
build_root=$(mktemp -d)
trap 'rm -rf "$build_root"' EXIT

apk add --no-cache \
  autoconf automake build-base curl libtool pkgconf \
  lz4-dev lz4-static util-linux-dev util-linux-static \
  zlib-dev zlib-static zstd-dev zstd-static

curl --proto '=https' --tlsv1.2 -fsSL --retry 5 "$EROFS_UTILS_URL" -o "$build_root/erofs-utils.tar.gz"
echo "${EROFS_UTILS_SHA256}  $build_root/erofs-utils.tar.gz" | sha256sum -c -
tar -xzf "$build_root/erofs-utils.tar.gz" -C "$build_root"

cd "$build_root/erofs-utils-${EROFS_UTILS_VERSION}"
./autogen.sh
./configure \
  --enable-lz4 --enable-multithreading --with-libzstd --with-zlib --with-uuid \
  --disable-lzma --disable-fuse --disable-ublk --disable-s3 --disable-oci --disable-fanotify \
  --without-libdeflate --without-qpl --without-xxhash --without-libcurl --without-openssl \
  --without-libxml2 --without-json_c --without-libnl3 --without-selinux \
  --disable-shared --enable-static
make -j"$(nproc)" -C lib
make -j"$(nproc)" -C mkfs LDFLAGS=-all-static
strip mkfs/mkfs.erofs
mkdir -p "$output_dir"
install -m 0555 mkfs/mkfs.erofs "$output_dir/mkfs.erofs"
"$output_dir/mkfs.erofs" --version
