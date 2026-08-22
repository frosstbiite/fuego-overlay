const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')
const packageJson = JSON.parse(
  fs.readFileSync(
    path.join(projectRoot, 'package.json'),
    'utf8',
  ),
)

const version = packageJson.version
const releaseDir = path.join(projectRoot, 'release')
const unpackedDir = path.join(releaseDir, 'win-unpacked')
const appAsar = path.join(
  unpackedDir,
  'resources',
  'app.asar',
)

if (!fs.existsSync(appAsar)) {
  console.error(
    '\nFuego patch build could not find:\n' +
    `  ${appAsar}\n\n` +
    'Run "npm.cmd run patch:build" to build the Windows app and patch together,\n' +
    'or build win-unpacked first and then run "npm.cmd run patch:create".\n',
  )
  process.exit(1)
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function fileSize(filePath) {
  return fs.statSync(filePath).size
}

function powershellQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

const patchName =
  `Fuego-Patch-${version}.zip`

const manifestName =
  `Fuego-Patch-${version}-manifest.json`

const patchPath =
  path.join(releaseDir, patchName)

const manifestPath =
  path.join(releaseDir, manifestName)

const stagingRoot =
  path.join(releaseDir, '.patch-staging')

fs.rmSync(
  stagingRoot,
  {
    recursive: true,
    force: true,
  },
)

fs.mkdirSync(
  path.join(
    stagingRoot,
    'resources',
  ),
  {
    recursive: true,
  },
)

fs.copyFileSync(
  appAsar,
  path.join(
    stagingRoot,
    'resources',
    'app.asar',
  ),
)

fs.rmSync(
  patchPath,
  {
    force: true,
  },
)

const compressCommand = [
  '$ErrorActionPreference = "Stop";',
  `Compress-Archive -Path ${powershellQuote(path.join(stagingRoot, '*'))}`,
  `-DestinationPath ${powershellQuote(patchPath)}`,
  '-CompressionLevel Optimal -Force',
].join(' ')

const result = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    compressCommand,
  ],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
  },
)

if (result.status !== 0) {
  console.error(
    '\nPowerShell could not create the Fuego patch ZIP.\n',
  )
  process.exit(
    result.status || 1,
  )
}

const appAsarHash =
  sha256(appAsar)

const patchHash =
  sha256(patchPath)

const manifest = {
  schemaVersion: 1,
  product: 'Fuego Overlay',
  version,
  createdAt:
    new Date().toISOString(),
  patchFile: patchName,
  patchSha256: patchHash,
  files: [
    {
      path: 'resources/app.asar',
      sha256: appAsarHash,
      size: fileSize(appAsar),
    },
  ],
}

fs.writeFileSync(
  manifestPath,
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
)

const manifestHash =
  sha256(manifestPath)

const tag = `v${version}`

let previousLatest = {}
try {
  previousLatest = JSON.parse(
    fs.readFileSync(
      path.join(projectRoot, 'updates', 'latest.json'),
      'utf8',
    ),
  )
} catch {
  previousLatest = {}
}

const latest = {
  schemaVersion: 1,
  product: 'Fuego Overlay',
  version,
  minimumUpdaterVersion: '1.1.1',
  requiresInstaller: false,
  notes:
    'Fuego Overlay maintenance update.',
  releaseUrl:
    `https://github.com/frosstbiite/fuego-overlay/releases/tag/${tag}`,
  installerUrl:
    previousLatest.installerUrl ||
    'https://github.com/frosstbiite/fuego-overlay/releases/tag/v1.1.1',
  patchUrl:
    `https://github.com/frosstbiite/fuego-overlay/releases/download/${tag}/${patchName}`,
  patchSha256: patchHash,
  manifestUrl:
    `https://github.com/frosstbiite/fuego-overlay/releases/download/${tag}/${manifestName}`,
  manifestSha256:
    manifestHash,
}

const updatesDir =
  path.join(
    projectRoot,
    'updates',
  )

fs.mkdirSync(
  updatesDir,
  {
    recursive: true,
  },
)

fs.writeFileSync(
  path.join(
    updatesDir,
    'latest.json',
  ),
  `${JSON.stringify(latest, null, 2)}\n`,
  'utf8',
)

fs.rmSync(
  stagingRoot,
  {
    recursive: true,
    force: true,
  },
)

console.log('')
console.log('Fuego patch created successfully:')
console.log(`  ${patchPath}`)
console.log(`  ${manifestPath}`)
console.log('')
console.log('GitHub Release assets to upload:')
console.log(`  ${patchName}`)
console.log(`  ${manifestName}`)
console.log('')
console.log('Then commit/push:')
console.log('  updates/latest.json')
console.log('')
console.log(
  'IMPORTANT: Upload the two Release assets before pushing latest.json.',
)
console.log('')
