# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-28

### Added
- **Direct SFTP Streaming Downloads**: Implemented direct file and folder structure downloads in Electron without intermediate ZIP compression, including a native directory picker (`sftp:select-directory`) and clean abort handling.
- **OS-Native Drag-and-Drop Target Folder Resolution**: Implemented active folder target resolution (via PowerShell COM `Shell.Application` on Windows, AppleScript on macOS) to automatically copy and extract dropped downloads into the user's active file explorer view.
- **Packaging and Distribution**: Integrated `electron-builder` with custom scripts (`dist`, `dist:win`, `dist:mac`, `dist:linux`) for building installers and binaries.
- **Post-Install Build Patch**: Added `scripts/patch-node-pty.js` to automatically disable SpectreMitigation in `winpty.gyp` during npm install, fixing Windows compilation errors.
- **Developer Tools Toggle**: Added a global keyboard event handler for `F12` and `Ctrl+Shift+I` / `Cmd+Option+I` to open or detach Developer Tools.
- **Detailed Progress Banners**: Updated SFTP transfer progress UI component to track files explored, files processed, folder counts, and overall byte transfer rates.

### Changed
- **Electron-First Consolidation**: Restructured the project to focus on a standalone, local Electron-first application lifecycle.
- **Connection Fallback**: Updated SFTP listing endpoint `/api/sftp/list` to accept direct host/port/credentials query params, avoiding strict profile-only limitations.

### Removed
- **KBS Cloud SSO Integration**: Removed OAuth configuration, `SSOLoginPanel`, `AuthModal`, and the remote SSO helper module.

### Fixed
- **App Crash Mitigation**: Added startup command-line switches `disable-breakpad` and `no-crash-upload` to prevent sudden app terminations.
- **Reliable Data Persistence**: Updated backend tests to cover direct file/folder streaming, dynamic ZIP progress, and verified that in-flight aborted files are cleaned up correctly while keeping completed files intact.
