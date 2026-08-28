# Changelog - v1.3.0

## New Features
- **Split-Window File Manager**: You can now access a dedicated File Manager view from the left sidebar with 1-pane, 2-pane (50/50), 3-pane (33/33/33), and 4-pane (2x2 grid) layout modes.
- **Standalone SFTP Sessions**: You can connect directly to any saved server profile or ad-hoc SFTP connection without opening an SSH terminal session.
- **Local Filesystem Explorer**: You can now browse local drives (C:\, D:\) and quick folders (Home, Desktop, Downloads, Documents) alongside your remote servers.
- **Cross-Session Transfers**: You can drag and drop or transfer files directly between any combination of sessions (Remote SFTP to Remote SFTP, Local to Remote, Remote to Local, and Local to Local).
- **Transfer Queue & Real-Time Progress**: An expandable bottom drawer displays active transfer progress bars, speed, and cancel options.

## Bug Fixes & Improvements
- **Transfer Completion Guards**: All files and directories transferred before a cancellation or error remain safely preserved on the destination.
- **Recursive Folder Creation**: Destination folders and nested parent directory hierarchies are automatically created upon starting transfers.
- **Automatic Directory Refresh**: Split panes automatically refresh and display newly created or transferred files immediately upon completion or cancellation.
- **Direct Pane Dropzone**: Dropping files into a pane always transfers directly into the open destination folder without accidentally selecting subfolder rows.
