// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;
use std::os::unix::fs::{MetadataExt, PermissionsExt};
use std::path::{Path, PathBuf};

use russh_sftp::protocol::{
    Attrs, Data, FileAttributes, Handle, Name, OpenFlags, Status, StatusCode,
};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};

pub struct SftpHandler {
    handles: HashMap<String, HandleEntry>,
    next_handle: u64,
}

enum HandleEntry {
    File(tokio::fs::File),
    Dir {
        entries: Vec<russh_sftp::protocol::File>,
        read: bool,
    },
}

impl Default for SftpHandler {
    fn default() -> Self {
        Self {
            handles: HashMap::default(),
            next_handle: 0,
        }
    }
}

impl SftpHandler {
    fn alloc_handle(&mut self) -> String {
        let h = self.next_handle;
        self.next_handle += 1;
        format!("h{h}")
    }
}

fn metadata_to_attrs(meta: &std::fs::Metadata) -> FileAttributes {
    FileAttributes::from(meta)
}

fn file_entry(name: &str, meta: &std::fs::Metadata) -> russh_sftp::protocol::File {
    let attrs = metadata_to_attrs(meta);
    let long_name = format_long_name(name, meta);
    russh_sftp::protocol::File {
        filename: name.to_string(),
        longname: long_name,
        attrs,
    }
}

fn format_long_name(name: &str, meta: &std::fs::Metadata) -> String {
    let mode = meta.permissions().mode();
    let file_type = if meta.is_dir() {
        'd'
    } else if meta.is_symlink() {
        'l'
    } else {
        '-'
    };

    let perms = [
        if mode & 0o400 != 0 { 'r' } else { '-' },
        if mode & 0o200 != 0 { 'w' } else { '-' },
        if mode & 0o100 != 0 { 'x' } else { '-' },
        if mode & 0o040 != 0 { 'r' } else { '-' },
        if mode & 0o020 != 0 { 'w' } else { '-' },
        if mode & 0o010 != 0 { 'x' } else { '-' },
        if mode & 0o004 != 0 { 'r' } else { '-' },
        if mode & 0o002 != 0 { 'w' } else { '-' },
        if mode & 0o001 != 0 { 'x' } else { '-' },
    ];

    let perm_str: String = perms.iter().collect();
    format!(
        "{file_type}{perm_str} 1 {uid} {gid} {size:>8} Jan  1 00:00 {name}",
        uid = meta.uid(),
        gid = meta.gid(),
        size = meta.len(),
    )
}

impl russh_sftp::server::Handler for SftpHandler {
    type Error = StatusCode;

    fn unimplemented(&self) -> Self::Error {
        StatusCode::OpUnsupported
    }

    async fn open(
        &mut self,
        id: u32,
        filename: String,
        pflags: OpenFlags,
        _attrs: FileAttributes,
    ) -> Result<Handle, Self::Error> {
        let path = Path::new(&filename);
        let mut opts = tokio::fs::OpenOptions::default();

        if pflags.contains(OpenFlags::READ) {
            opts.read(true);
        }
        if pflags.contains(OpenFlags::WRITE) {
            opts.write(true);
        }
        if pflags.contains(OpenFlags::APPEND) {
            opts.append(true);
        }
        if pflags.contains(OpenFlags::CREATE) {
            opts.create(true);
        }
        if pflags.contains(OpenFlags::TRUNCATE) {
            opts.truncate(true);
        }
        if pflags.contains(OpenFlags::EXCLUDE) {
            opts.create_new(true);
        }

        let file = opts.open(path).await.map_err(io_to_status)?;
        let handle = self.alloc_handle();
        self.handles.insert(handle.clone(), HandleEntry::File(file));
        Ok(Handle { id, handle })
    }

    async fn close(&mut self, id: u32, handle: String) -> Result<Status, Self::Error> {
        self.handles.remove(&handle);
        Ok(Status {
            id,
            status_code: StatusCode::Ok,
            error_message: "Ok".into(),
            language_tag: "en-US".into(),
        })
    }

    async fn read(
        &mut self,
        id: u32,
        handle: String,
        offset: u64,
        len: u32,
    ) -> Result<Data, Self::Error> {
        let entry = self.handles.get_mut(&handle).ok_or(StatusCode::Failure)?;
        let HandleEntry::File(file) = entry else {
            return Err(StatusCode::Failure);
        };

        file.seek(std::io::SeekFrom::Start(offset))
            .await
            .map_err(io_to_status)?;

        let mut buf = vec![0u8; len as usize];
        let n = file.read(&mut buf).await.map_err(io_to_status)?;

        if n == 0 {
            return Err(StatusCode::Eof);
        }

        buf.truncate(n);
        Ok(Data { id, data: buf })
    }

    async fn write(
        &mut self,
        id: u32,
        handle: String,
        offset: u64,
        data: Vec<u8>,
    ) -> Result<Status, Self::Error> {
        let entry = self.handles.get_mut(&handle).ok_or(StatusCode::Failure)?;
        let HandleEntry::File(file) = entry else {
            return Err(StatusCode::Failure);
        };

        file.seek(std::io::SeekFrom::Start(offset))
            .await
            .map_err(io_to_status)?;
        file.write_all(&data).await.map_err(io_to_status)?;

        Ok(Status {
            id,
            status_code: StatusCode::Ok,
            error_message: "Ok".into(),
            language_tag: "en-US".into(),
        })
    }

    async fn lstat(&mut self, id: u32, path: String) -> Result<Attrs, Self::Error> {
        let meta = fs::symlink_metadata(&path).await.map_err(io_to_status)?;
        Ok(Attrs {
            id,
            attrs: metadata_to_attrs(&meta),
        })
    }

    async fn fstat(&mut self, id: u32, handle: String) -> Result<Attrs, Self::Error> {
        let entry = self.handles.get(&handle).ok_or(StatusCode::Failure)?;
        let HandleEntry::File(file) = entry else {
            return Err(StatusCode::Failure);
        };

        let meta = file.metadata().await.map_err(io_to_status)?;
        Ok(Attrs {
            id,
            attrs: metadata_to_attrs(&meta),
        })
    }

    async fn setstat(
        &mut self,
        id: u32,
        path: String,
        attrs: FileAttributes,
    ) -> Result<Status, Self::Error> {
        if let Some(perms) = attrs.permissions {
            fs::set_permissions(&path, std::fs::Permissions::from_mode(perms))
                .await
                .map_err(io_to_status)?;
        }
        Ok(Status {
            id,
            status_code: StatusCode::Ok,
            error_message: "Ok".into(),
            language_tag: "en-US".into(),
        })
    }

    async fn fsetstat(
        &mut self,
        id: u32,
        handle: String,
        attrs: FileAttributes,
    ) -> Result<Status, Self::Error> {
        let entry = self.handles.get(&handle).ok_or(StatusCode::Failure)?;
        let HandleEntry::File(file) = entry else {
            return Err(StatusCode::Failure);
        };

        if let Some(perms) = attrs.permissions {
            file.set_permissions(std::fs::Permissions::from_mode(perms))
                .await
                .map_err(io_to_status)?;
        }
        Ok(Status {
            id,
            status_code: StatusCode::Ok,
            error_message: "Ok".into(),
            language_tag: "en-US".into(),
        })
    }

    async fn opendir(&mut self, id: u32, path: String) -> Result<Handle, Self::Error> {
        let dir_path = PathBuf::from(&path);
        let mut entries = Vec::default();

        entries.push(file_entry(
            ".",
            &std::fs::metadata(&dir_path).map_err(io_to_status)?,
        ));
        if let Some(parent) = dir_path.parent()
            && let Ok(meta) = std::fs::metadata(parent)
        {
            entries.push(file_entry("..", &meta));
        }

        let mut read_dir = fs::read_dir(&path).await.map_err(io_to_status)?;
        while let Ok(Some(entry)) = read_dir.next_entry().await {
            if let Ok(meta) = entry.metadata().await {
                let name = entry.file_name().to_string_lossy().to_string();
                entries.push(file_entry(&name, &meta));
            }
        }

        let handle = self.alloc_handle();
        self.handles.insert(
            handle.clone(),
            HandleEntry::Dir {
                entries,
                read: false,
            },
        );
        Ok(Handle { id, handle })
    }

    async fn readdir(&mut self, id: u32, handle: String) -> Result<Name, Self::Error> {
        let entry = self.handles.get_mut(&handle).ok_or(StatusCode::Failure)?;
        let HandleEntry::Dir { entries, read, .. } = entry else {
            return Err(StatusCode::Failure);
        };

        if *read {
            return Err(StatusCode::Eof);
        }

        *read = true;
        Ok(Name {
            id,
            files: entries.clone(),
        })
    }

    async fn remove(&mut self, id: u32, filename: String) -> Result<Status, Self::Error> {
        fs::remove_file(&filename).await.map_err(io_to_status)?;
        Ok(Status {
            id,
            status_code: StatusCode::Ok,
            error_message: "Ok".into(),
            language_tag: "en-US".into(),
        })
    }

    async fn mkdir(
        &mut self,
        id: u32,
        path: String,
        _attrs: FileAttributes,
    ) -> Result<Status, Self::Error> {
        fs::create_dir(&path).await.map_err(io_to_status)?;
        Ok(Status {
            id,
            status_code: StatusCode::Ok,
            error_message: "Ok".into(),
            language_tag: "en-US".into(),
        })
    }

    async fn rmdir(&mut self, id: u32, path: String) -> Result<Status, Self::Error> {
        fs::remove_dir(&path).await.map_err(io_to_status)?;
        Ok(Status {
            id,
            status_code: StatusCode::Ok,
            error_message: "Ok".into(),
            language_tag: "en-US".into(),
        })
    }

    async fn realpath(&mut self, id: u32, path: String) -> Result<Name, Self::Error> {
        let canonical = fs::canonicalize(&path).await.map_err(io_to_status)?;
        let name = canonical.to_string_lossy().to_string();

        let meta = fs::metadata(&canonical).await.map_err(io_to_status)?;
        let attrs = metadata_to_attrs(&meta);

        Ok(Name {
            id,
            files: vec![russh_sftp::protocol::File {
                filename: name.clone(),
                longname: name,
                attrs,
            }],
        })
    }

    async fn stat(&mut self, id: u32, path: String) -> Result<Attrs, Self::Error> {
        let meta = fs::metadata(&path).await.map_err(io_to_status)?;
        Ok(Attrs {
            id,
            attrs: metadata_to_attrs(&meta),
        })
    }

    async fn rename(
        &mut self,
        id: u32,
        oldpath: String,
        newpath: String,
    ) -> Result<Status, Self::Error> {
        fs::rename(&oldpath, &newpath).await.map_err(io_to_status)?;
        Ok(Status {
            id,
            status_code: StatusCode::Ok,
            error_message: "Ok".into(),
            language_tag: "en-US".into(),
        })
    }

    async fn readlink(&mut self, id: u32, path: String) -> Result<Name, Self::Error> {
        let target = fs::read_link(&path).await.map_err(io_to_status)?;
        let name = target.to_string_lossy().to_string();

        Ok(Name {
            id,
            files: vec![russh_sftp::protocol::File {
                filename: name.clone(),
                longname: name,
                attrs: FileAttributes::default(),
            }],
        })
    }

    async fn symlink(
        &mut self,
        id: u32,
        linkpath: String,
        targetpath: String,
    ) -> Result<Status, Self::Error> {
        tokio::fs::symlink(&targetpath, &linkpath)
            .await
            .map_err(io_to_status)?;
        Ok(Status {
            id,
            status_code: StatusCode::Ok,
            error_message: "Ok".into(),
            language_tag: "en-US".into(),
        })
    }
}

fn io_to_status(err: std::io::Error) -> StatusCode {
    match err.kind() {
        std::io::ErrorKind::NotFound => StatusCode::NoSuchFile,
        std::io::ErrorKind::PermissionDenied => StatusCode::PermissionDenied,
        _ => StatusCode::Failure,
    }
}
