import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const here = fileURLToPath(import.meta.url)
const assets = join(dirname(here), '..', 'assets')

const ICO_SIZES = [16, 20, 24, 32, 36, 40, 48, 64, 72, 96, 128, 256]
const TRAY_ICO_SIZES = [16, 20, 24, 32]
const TRAY_PNG_SIZE = 24
const TRAY_TEMPLATE_SIZES = [16, 32]

// Superellipse squircle matching macOS / Windows app icon tile
function tile(size, inset) {
  const radius = (size - 2 * inset) / 2
  const center = size / 2
  const points = []
  for (let i = 0; i < 128; i += 1) {
    const angle = (i / 128) * Math.PI * 2
    const at = value => Math.sign(value) * Math.abs(value) ** 0.4
    points.push(`${(center + radius * at(Math.cos(angle))).toFixed(2)} ${(center + radius * at(Math.sin(angle))).toFixed(2)}`)
  }
  return `M${points.join('L')}Z`
}

function icoFile(images) {
  const head = Buffer.alloc(6 + 16 * images.length)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(images.length, 4)
  let offset = head.length
  images.forEach(({ size, png }, index) => {
    const at = 6 + 16 * index
    head.writeUInt8(size >= 256 ? 0 : size, at)
    head.writeUInt8(size >= 256 ? 0 : size, at + 1)
    head.writeUInt16LE(1, at + 4)
    head.writeUInt16LE(32, at + 6)
    head.writeUInt32LE(png.length, at + 8)
    head.writeUInt32LE(offset, at + 12)
    offset += png.length
  })
  return Buffer.concat([head, ...images.map(image => image.png)])
}

export async function buildIcons() {
  const isotipoBuf = readFileSync(join(assets, 'isotipo.png'))
  const base64Isotipo = `data:image/png;base64,${isotipoBuf.toString('base64')}`

  function iconSvg(plate, size = 1024) {
    const inset = (size * (1 - plate)) / 2
    const path = tile(size, inset)
    const innerSize = (size - 2 * inset) * 0.72
    const x = (size - innerSize) / 2
    const y = (size - innerSize * (553 / 608)) / 2 - size * 0.01

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>
  <linearGradient id="tileBg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#142638"/>
    <stop offset="50%" stop-color="#0E1A27"/>
    <stop offset="100%" stop-color="#070D14"/>
  </linearGradient>
  <radialGradient id="centerGlow" cx="50%" cy="45%" r="60%">
    <stop offset="0%" stop-color="#00C8FF" stop-opacity="0.22"/>
    <stop offset="60%" stop-color="#0891B2" stop-opacity="0.05"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
  </radialGradient>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="${(size * 0.015).toFixed(1)}" stdDeviation="${(size * 0.018).toFixed(1)}" flood-color="#000" flood-opacity="0.45"/>
  </filter>
  <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="${(size * 0.01).toFixed(1)}" stdDeviation="${(size * 0.012).toFixed(1)}" flood-color="#000" flood-opacity="0.35"/>
  </filter>
</defs>
<path d="${path}" fill="url(#tileBg)" filter="url(#shadow)"/>
<path d="${path}" fill="url(#centerGlow)"/>
<path d="${path}" fill="none" stroke="rgba(0, 200, 255, 0.28)" stroke-width="${Math.max(1, size * 0.003).toFixed(1)}"/>
<image href="${base64Isotipo}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${innerSize.toFixed(1)}" height="${(innerSize * (553 / 608)).toFixed(1)}" filter="url(#logoGlow)"/>
</svg>`
  }

  // 1. Write icon.svg
  const svg1024 = iconSvg(0.805, 1024)
  writeFileSync(join(assets, 'icon.svg'), svg1024)

  // 2. Generate icon.png (1024x1024)
  const iconPng = await sharp(Buffer.from(svg1024)).png().toBuffer()
  writeFileSync(join(assets, 'icon.png'), iconPng)

  // 3. Generate icon.ico (sizes 16 to 256)
  const icoImages = await Promise.all(
    ICO_SIZES.map(async size => {
      const svg = iconSvg(0.92, size)
      const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
      return { size, png }
    })
  )
  writeFileSync(join(assets, 'icon.ico'), icoFile(icoImages))

  // 4. Generate Tray icons (isotipo only with transparent background)
  const trayIcoImages = await Promise.all(
    TRAY_ICO_SIZES.map(async size => {
      const png = await sharp(isotipoBuf)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      return { size, png }
    })
  )
  writeFileSync(join(assets, 'tray.ico'), icoFile(trayIcoImages))

  const trayPng = await sharp(isotipoBuf)
    .resize(TRAY_PNG_SIZE, TRAY_PNG_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  writeFileSync(join(assets, 'tray.png'), trayPng)

  // 5. Generate macOS tray template (monochrome black #000000 with alpha)
  const { data, info } = await sharp(isotipoBuf).raw().toBuffer({ resolveWithObject: true })
  const monoBuf = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    monoBuf[i] = 0
    monoBuf[i + 1] = 0
    monoBuf[i + 2] = 0
    monoBuf[i + 3] = a > 25 ? a : 0
  }
  const monoImg = sharp(monoBuf, { raw: { width: info.width, height: info.height, channels: 4 } })

  const trayTemplate16 = await monoImg
    .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  writeFileSync(join(assets, 'trayTemplate.png'), trayTemplate16)

  const trayTemplate32 = await monoImg
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  writeFileSync(join(assets, 'trayTemplate@2x.png'), trayTemplate32)

  console.log('Successfully generated all Atenea / Iruz Labs assets in app/assets!')
}

buildIcons().catch(console.error)
