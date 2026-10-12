import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { decodeRgbaPng, encodeRgbaPng, readPngMetadata } from "../../image-providers/xhs-integrated-page/png-normalizer.mjs";

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
let crcTable;
function crc32(buffer) {
  crcTable ||= Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let crc = 0xffffffff; for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) { const name = Buffer.from(type); const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length); name.copy(out, 4); data.copy(out, 8); out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8); return out; }
function png({ width = 2, height = 1, bitDepth = 8, colorType = 2, interlace = 0, filter = 0, samples = Buffer.from([10, 20, 30, 40, 50, 60]), packed = null } = {}) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = bitDepth; header[9] = colorType; header[12] = interlace;
  return Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", deflateSync(packed || Buffer.concat([Buffer.from([filter]), samples]))), chunk("IEND", Buffer.alloc(0))]);
}

const rgb = png(); const decodedRgb = decodeRgbaPng(rgb);
assert.deepEqual(readPngMetadata(rgb), { width: 2, height: 1, bitDepth: 8, colorType: 2, compression: 0, filterMethod: 0, interlace: 0 });
assert.deepEqual([...decodedRgb.pixels], [10, 20, 30, 255, 40, 50, 60, 255]);
const rgbaPixels = Buffer.from([10, 20, 30, 4, 40, 50, 60, 70]); const rgba = encodeRgbaPng(2, 1, rgbaPixels);
assert.deepEqual([...decodeRgbaPng(rgba).pixels], [...rgbaPixels]);
assert.throws(() => decodeRgbaPng(png({ colorType: 0, samples: Buffer.from([1, 2]) })), /PNG_COLOR_TYPE_UNSUPPORTED/);
assert.throws(() => decodeRgbaPng(png({ bitDepth: 16, samples: Buffer.alloc(12) })), /PNG_BIT_DEPTH_UNSUPPORTED/);
assert.throws(() => decodeRgbaPng(png({ interlace: 1 })), /PNG_INTERLACE_UNSUPPORTED/);
assert.throws(() => decodeRgbaPng(png({ filter: 5 })), /PNG_FILTER_UNSUPPORTED/);
assert.throws(() => decodeRgbaPng(png({ packed: Buffer.from([0, 1, 2]) })), /PNG_DECOMPRESSED_LENGTH_MISMATCH/);
assert.throws(() => decodeRgbaPng(rgb.subarray(0, rgb.length - 2)), /PNG_CHUNK_TRUNCATED|PNG_STRUCTURE_INCOMPLETE/);
const corrupt = Buffer.from(rgb); corrupt[corrupt.length - 5] ^= 1;
assert.throws(() => decodeRgbaPng(corrupt), /PNG_CRC_MISMATCH/);
assert.throws(() => decodeRgbaPng(Buffer.concat([rgb, Buffer.from([0])])), /PNG_TRAILING_DATA/);
console.log(JSON.stringify({ status: "passed", rgbSha256: createHash("sha256").update(rgb).digest("hex"), rgbAlphaExpansion: "255", rgbaCompatibility: true, corruptionCases: 7, networkCalls: 0, providerCalls: 0 }));
