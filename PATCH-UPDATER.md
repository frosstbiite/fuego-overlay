# Fuego In-App Patch Updater

Starting with **v1.1.1**, packaged Fuego Overlay builds can install small maintenance updates directly from the **Check for Updates** button.

## Where updates live

Fuego always checks:

`updates/latest.json`

from the `main` branch on GitHub.

That file contains the current version plus HTTPS links and SHA-256 hashes for the patch ZIP and its manifest. The patch ZIP and manifest belong in a normal GitHub Release as release assets; binary patch ZIPs do **not** need to be committed to the repository.

## First updater-enabled release: v1.1.1

v1.1.1 is the baseline installer that introduces the updater. Existing v1.1.0 installations do not have the patch engine yet, so they need to install the v1.1.1 full installer once.

For v1.1.1:

1. Build the normal Windows installer:
   `npm.cmd run dist`
2. Upload `release/Fuego-Overlay-Setup-1.1.1.exe` to the GitHub Release `v1.1.1`.
3. Push the v1.1.1 source and `updates/latest.json`.

The baseline `latest.json` has `requiresInstaller: true`, so v1.1.0 users are sent to the full v1.1.1 installer. A running v1.1.1 install sees itself as current.

## Small patch releases after v1.1.1

For a source-only maintenance update such as v1.1.2:

1. Change the version in `package.json` and `package-lock.json`.
2. Test Fuego normally.
3. Run:
   `npm.cmd run patch:build`
4. The command creates:
   - `release/Fuego-Patch-1.1.2.zip`
   - `release/Fuego-Patch-1.1.2-manifest.json`
   - an updated `updates/latest.json`
5. Create GitHub Release `v1.1.2`.
6. Upload the ZIP and manifest as release assets.
7. Only **after those assets are uploaded**, commit/push the generated `updates/latest.json`.

Users on v1.1.1+ can then press **Check for Updates**. Fuego downloads the patch, verifies SHA-256, stages it, closes, replaces the packaged `resources/app.asar`, and restarts.

## What belongs in a patch

The patch builder deliberately replaces the complete packaged `resources/app.asar`. That bundle contains Fuego's React UI, telemetry service bundle, Electron app code, preload code, and normal packaged assets. It is usually much smaller than the full Windows installer and is safe for ordinary source-only changes.

Use a **full installer** instead of a patch when the update changes:

- Electron itself or the Windows runtime
- Native modules / unpacked native binaries
- Installation behavior, shortcuts, or NSIS settings
- Files outside `resources/app.asar`
- Anything that requires administrator-level installation changes

For such a release, set `requiresInstaller: true` in `updates/latest.json` and update `installerUrl` to the new full-installer release.

## Safety

Fuego does not copy an update into the installation until all of these checks pass:

- update metadata came from the fixed GitHub HTTPS location
- patch ZIP SHA-256 matches `latest.json`
- manifest SHA-256 matches `latest.json`
- every staged file SHA-256 matches the manifest
- manifest paths are checked for traversal attempts

If verification fails, Fuego leaves the installed application untouched and reports the failure.

## Important release order

**Upload GitHub Release patch assets first. Push `updates/latest.json` second.**

If `latest.json` is pushed before the release assets exist, users may temporarily see an update that cannot be downloaded.
