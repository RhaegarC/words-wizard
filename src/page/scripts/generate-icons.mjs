// Placeholder icon generator for the app foundation.
// Replaced by the approved brand artwork in feature 17 (content production).
//
// Run with: node scripts/generate-icons.mjs
// Writes src/page/public/icons/icon-192.png, icon-512.png, and maskable-512.png.

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { deflateSync } from "node:zlib"

const here = dirname(fileURLToPath(import.meta.url))
const outputDir = join(here, "..", "public", "icons")

const BACKGROUND = [0x70, 0x59, 0xdc]
const FOREGROUND = [0xff, 0xff, 0xff]

// A simple "W" drawn as four strokes in unit coordinates.
const STROKES = [
  [
    [0.2, 0.28],
    [0.36, 0.72],
  ],
  [
    [0.36, 0.72],
    [0.5, 0.45],
  ],
  [
    [0.5, 0.45],
    [0.64, 0.72],
  ],
  [
    [0.64, 0.72],
    [0.8, 0.28],
  ],
]

function crcTable() {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
}

const CRC_TABLE = crcTable()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ])
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  header[10] = 0 // compression
  header[11] = 0 // filter
  header[12] = 0 // interlace

  const rowBytes = width * 4 + 1
  const raw = Buffer.alloc(rowBytes * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * rowBytes] = 0 // no per-row filter
    pixels.copy(raw, y * rowBytes + 1, y * width * 4, (y + 1) * width * 4)
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared),
  )
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function drawIcon(size, scale) {
  const pixels = Buffer.alloc(size * size * 4)
  const strokeHalfWidth = 0.05 * scale
  const feather = 1.5 / size

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const su = 0.5 + (u - 0.5) / scale
      const sv = 0.5 + (v - 0.5) / scale

      let distance = Infinity
      for (const [a, b] of STROKES) {
        distance = Math.min(distance, distanceToSegment(su, sv, a, b))
      }

      const coverage = Math.max(
        0,
        Math.min(1, (strokeHalfWidth + feather - distance) / feather),
      )
      const offset = (y * size + x) * 4
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(
          BACKGROUND[channel] +
            (FOREGROUND[channel] - BACKGROUND[channel]) * coverage,
        )
      }
      pixels[offset + 3] = 255
    }
  }

  return pixels
}

mkdirSync(outputDir, { recursive: true })

for (const [name, size, scale] of [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["maskable-512.png", 512, 0.85],
]) {
  writeFileSync(
    join(outputDir, name),
    encodePng(size, size, drawIcon(size, scale)),
  )
  console.log(`wrote public/icons/${name}`)
}
