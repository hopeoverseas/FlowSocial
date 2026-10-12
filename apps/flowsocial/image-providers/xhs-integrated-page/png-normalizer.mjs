import { createHash } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { stableHash } from "./canonical.mjs";
import { makeBlocker, validatePageNormalizationRecord, VERTICAL_CONTRACTS, withHash } from "./vertical-contracts.mjs";

const TARGET = Object.freeze({ width: 1080, height: 1440 });
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
let crcTable;
function crc32(buffer) {
  crcTable ||= Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let crc = 0xffffffff; for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type); const output = Buffer.alloc(12 + data.length); output.writeUInt32BE(data.length, 0); name.copy(output, 4); data.copy(output, 8); output.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length); return output;
}
export function encodeRgbaPng(width, height, rgba) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || rgba.length !== width * height * 4) throw new Error("PNG_ENCODE_INPUT_INVALID");
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6; header[10] = 0; header[11] = 0; header[12] = 0;
  const rows = Buffer.alloc(height * (1 + width * 4)); for (let y = 0; y < height; y += 1) { const offset = y * (1 + width * 4); rows[offset] = 0; rgba.copy(rows, offset + 1, y * width * 4, (y + 1) * width * 4); }
  return Buffer.concat([PNG_SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
export function solidRgbaPng(width, height, color = [244, 241, 233, 255]) {
  const pixels = Buffer.alloc(width * height * 4); for (let i = 0; i < pixels.length; i += 4) { pixels[i] = color[0]; pixels[i + 1] = color[1]; pixels[i + 2] = color[2]; pixels[i + 3] = color[3]; } return encodeRgbaPng(width, height, pixels);
}
export function readPngDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("PNG_SIGNATURE_INVALID");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
function paeth(a, b, c) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
function parsePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("PNG_SIGNATURE_INVALID");
  let offset = 8; let header = null; let sawIdat = false; let ended = false; const idat = [];
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) throw new Error("PNG_CHUNK_TRUNCATED");
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) throw new Error("PNG_CHUNK_TRUNCATED");
    const typeBytes = buffer.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = buffer.readUInt32BE(offset + 8 + length);
    if (crc32(Buffer.concat([typeBytes, data])) !== expectedCrc) throw new Error(`PNG_CRC_MISMATCH:${type}`);
    if (!header && type !== "IHDR") throw new Error("PNG_IHDR_MUST_BE_FIRST");
    if (type === "IHDR") {
      if (header || length !== 13) throw new Error("PNG_IHDR_INVALID");
      header = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9],
        compression: data[10], filterMethod: data[11], interlace: data[12]
      };
      if (!header.width || !header.height || header.width > 16_384 || header.height > 16_384) throw new Error("PNG_DIMENSIONS_INVALID");
    } else if (type === "IDAT") {
      if (ended) throw new Error("PNG_IDAT_AFTER_IEND");
      sawIdat = true; idat.push(data);
    } else if (type === "IEND") {
      if (length !== 0 || !sawIdat) throw new Error("PNG_IEND_INVALID");
      ended = true;
      if (end !== buffer.length) throw new Error("PNG_TRAILING_DATA");
    } else if ((typeBytes[0] & 0x20) === 0) throw new Error(`PNG_CRITICAL_CHUNK_UNSUPPORTED:${type}`);
    offset = end;
    if (ended) break;
  }
  if (!header || !sawIdat || !ended) throw new Error("PNG_STRUCTURE_INCOMPLETE");
  if (header.compression !== 0 || header.filterMethod !== 0) throw new Error("PNG_METHOD_UNSUPPORTED");
  if (header.interlace !== 0) throw new Error("PNG_INTERLACE_UNSUPPORTED");
  if (header.bitDepth !== 8) throw new Error("PNG_BIT_DEPTH_UNSUPPORTED");
  if (![2, 6].includes(header.colorType)) throw new Error("PNG_COLOR_TYPE_UNSUPPORTED");
  return { ...header, idat };
}
export function readPngMetadata(buffer) {
  const { idat: _idat, ...metadata } = parsePng(buffer);
  return metadata;
}
export function decodeRgbaPng(buffer) {
  const png = parsePng(buffer); const bytesPerPixel = png.colorType === 2 ? 3 : 4; const stride = png.width * bytesPerPixel;
  let packed;
  try { packed = inflateSync(Buffer.concat(png.idat)); } catch { throw new Error("PNG_DEFLATE_INVALID"); }
  if (packed.length !== png.height * (stride + 1)) throw new Error("PNG_DECOMPRESSED_LENGTH_MISMATCH");
  const reconstructedPixels = Buffer.alloc(stride * png.height);
  for (let y = 0; y < png.height; y += 1) {
    const rowOffset = y * (stride + 1); const filter = packed[rowOffset];
    if (filter > 4) throw new Error("PNG_FILTER_UNSUPPORTED");
    for (let x = 0; x < stride; x += 1) { const raw = packed[rowOffset + 1 + x]; const left = x >= bytesPerPixel ? reconstructedPixels[y * stride + x - bytesPerPixel] : 0; const up = y > 0 ? reconstructedPixels[(y - 1) * stride + x] : 0; const upLeft = y > 0 && x >= bytesPerPixel ? reconstructedPixels[(y - 1) * stride + x - bytesPerPixel] : 0; const reconstructed = filter === 0 ? raw : filter === 1 ? raw + left : filter === 2 ? raw + up : filter === 3 ? raw + Math.floor((left + up) / 2) : raw + paeth(left, up, upLeft); reconstructedPixels[y * stride + x] = reconstructed & 255; }
  }
  if (png.colorType === 6) return { width: png.width, height: png.height, bitDepth: 8, colorType: 6, pixels: reconstructedPixels };
  const pixels = Buffer.alloc(png.width * png.height * 4);
  for (let source = 0, target = 0; source < reconstructedPixels.length; source += 3, target += 4) {
    pixels[target] = reconstructedPixels[source]; pixels[target + 1] = reconstructedPixels[source + 1]; pixels[target + 2] = reconstructedPixels[source + 2]; pixels[target + 3] = 255;
  }
  return { width: png.width, height: png.height, bitDepth: 8, colorType: 2, pixels };
}
function sampleNearest(source, width, height, sourceRect, targetRect, target, background) {
  const output = Buffer.alloc(target.width * target.height * 4); for (let i = 0; i < output.length; i += 4) { output[i] = background[0]; output[i + 1] = background[1]; output[i + 2] = background[2]; output[i + 3] = background[3]; }
  for (let y = 0; y < targetRect.height; y += 1) for (let x = 0; x < targetRect.width; x += 1) {
    const sx = Math.min(width - 1, Math.max(0, Math.floor(sourceRect.x + (x + 0.5) * sourceRect.width / targetRect.width)));
    const sy = Math.min(height - 1, Math.max(0, Math.floor(sourceRect.y + (y + 0.5) * sourceRect.height / targetRect.height)));
    const si = (sy * width + sx) * 4; const ti = ((targetRect.y + y) * target.width + targetRect.x + x) * 4; source.copy(output, ti, si, si + 4);
  }
  return output;
}
function cropWindow(width, height) { const unit = Math.floor(Math.min(width / 3, height / 4)); const cropWidth = unit * 3; const cropHeight = unit * 4; return { x: Math.floor((width - cropWidth) / 2), y: Math.floor((height - cropHeight) / 2), width: cropWidth, height: cropHeight }; }
function contains(outer, inner) { return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height; }
const sameScale = (x, y) => Math.abs(x - y) <= Number.EPSILON * Math.max(1, Math.abs(x), Math.abs(y)) * 4;

export function normalizePngCandidate(input) {
  const decoded = decodeRgbaPng(input.sourceBuffer); const actualHash = sha256(input.sourceBuffer); const blockers = [];
  if (input.declaredSourceSha256 && input.declaredSourceSha256 !== actualHash) blockers.push(makeBlocker("SOURCE_ASSET_HASH_MISMATCH", input.candidateRef.id, "源图片声明 hash 与实际字节不一致"));
  const exactNative = decoded.width === TARGET.width && decoded.height === TARGET.height; const mode = input.mode;
  if (!["none", "fit_pad", "fit_crop", "resample"].includes(mode)) blockers.push(makeBlocker("NORMALIZATION_MODE_INVALID", input.candidateRef.id, `mode=${mode}`));
  let scaleX = 1; let scaleY = 1; let crop = null; let pad = null; let pixels = null; let backgroundStrategy = input.backgroundStrategy || null;
  if (mode === "none") { if (!exactNative) blockers.push(makeBlocker("NORMALIZATION_REQUIRED", input.candidateRef.id, "非目标尺寸不能使用 none")); else pixels = decoded.pixels; }
  if (mode === "resample") { scaleX = TARGET.width / decoded.width; scaleY = TARGET.height / decoded.height; if (decoded.width * TARGET.height !== decoded.height * TARGET.width || !sameScale(scaleX, scaleY)) blockers.push(makeBlocker("RESAMPLE_ASPECT_RATIO_MISMATCH", input.candidateRef.id, "等比 resample 不得改变宽高比")); else pixels = sampleNearest(decoded.pixels, decoded.width, decoded.height, { x: 0, y: 0, width: decoded.width, height: decoded.height }, { x: 0, y: 0, ...TARGET }, TARGET, [0, 0, 0, 0]); }
  if (mode === "fit_crop") { crop = cropWindow(decoded.width, decoded.height); scaleX = TARGET.width / crop.width; scaleY = TARGET.height / crop.height; if (!sameScale(scaleX, scaleY)) blockers.push(makeBlocker("NON_UNIFORM_PIXEL_GEOMETRY", input.candidateRef.id, "裁切后的实际横纵像素缩放不一致")); else if ((input.protectedRegions || []).some((region) => !contains(crop, region))) blockers.push(makeBlocker("PROTECTED_REGION_CROP", input.candidateRef.id, "裁切会穿过受保护文字或主体区域")); else pixels = sampleNearest(decoded.pixels, decoded.width, decoded.height, crop, { x: 0, y: 0, ...TARGET }, TARGET, [0, 0, 0, 0]); }
  if (mode === "fit_pad") {
    const backgrounds = { solid_brand_neutral_light: [244, 241, 233, 255], solid_brand_neutral_dark: [24, 53, 45, 255] };
    if (!backgrounds[backgroundStrategy]) blockers.push(makeBlocker("PAD_BACKGROUND_NOT_APPROVED", input.candidateRef.id, "填充必须使用批准的确定性背景策略"));
    else { const requestedScale = Math.min(1, TARGET.width / decoded.width, TARGET.height / decoded.height); const width = Math.round(decoded.width * requestedScale); const height = Math.round(decoded.height * requestedScale); scaleX = width / decoded.width; scaleY = height / decoded.height; pad = { left: Math.floor((TARGET.width - width) / 2), top: Math.floor((TARGET.height - height) / 2), right: TARGET.width - width - Math.floor((TARGET.width - width) / 2), bottom: TARGET.height - height - Math.floor((TARGET.height - height) / 2) }; if (!sameScale(scaleX, scaleY)) blockers.push(makeBlocker("NON_UNIFORM_PIXEL_GEOMETRY", input.candidateRef.id, "填充前的实际横纵像素缩放不一致")); else pixels = sampleNearest(decoded.pixels, decoded.width, decoded.height, { x: 0, y: 0, width: decoded.width, height: decoded.height }, { x: pad.left, y: pad.top, width, height }, TARGET, backgrounds[backgroundStrategy]); }
  }
  const outputBuffer = blockers.length ? null : encodeRgbaPng(TARGET.width, TARGET.height, pixels); const outputAsset = outputBuffer ? { relativePath: input.outputRelativePath, sha256: sha256(outputBuffer), bytes: outputBuffer.length, dimensions: { ...TARGET } } : null;
  const base = {
    schemaVersion: "1.0", contract: VERTICAL_CONTRACTS.normalization, id: input.id, candidateRef: structuredClone(input.candidateRef), mode, status: blockers.length ? "blocked" : "succeeded",
    inputAsset: { relativePath: input.sourceRelativePath, sha256: actualHash, bytes: input.sourceBuffer.length, dimensions: { width: decoded.width, height: decoded.height } }, outputAsset,
    inputDimensions: { width: decoded.width, height: decoded.height }, outputDimensions: { ...TARGET }, scale: { x: scaleX, y: scaleY, uniform: sameScale(scaleX, scaleY) }, crop, pad,
    protectedRegionCheck: { status: blockers.some((item) => item.code === "PROTECTED_REGION_CROP") ? "failed" : "passed", regionsHash: stableHash(input.protectedRegions || []) }, backgroundStrategy,
    blockers, createdAt: input.createdAt
  };
  const record = withHash(base, "recordHash"); validatePageNormalizationRecord(record); return { record, outputBuffer, providerNativeDimensionStatus: exactNative ? "passed" : "failed", finalCanvasStatus: outputBuffer && readPngDimensions(outputBuffer).width === 1080 && readPngDimensions(outputBuffer).height === 1440 ? "passed" : "blocked" };
}

export { TARGET as INTEGRATED_PAGE_TARGET, sha256 as sha256Bytes };
