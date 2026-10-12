import { deflateRawSync, inflateRawSync } from "node:zlib";

let crcTable;
function crc32(buffer) {
  crcTable ||= Array.from({ length: 256 }, (_, n) => {
    let value = n;
    for (let index = 0; index < 8; index += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const fixedDosStamp = Object.freeze({ time: 0, date: (1 << 5) | 1 });

export function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const name = Buffer.from(String(entry.name).replace(/\\/g, "/"), "utf8");
    const compressed = deflateRawSync(data, { level: 6 });
    const crc = crc32(data);
    const flags = 0x0800;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(fixedDosStamp.time, 10); local.writeUInt16LE(fixedDosStamp.date, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(8, 10); central.writeUInt16LE(fixedDosStamp.time, 12); central.writeUInt16LE(fixedDosStamp.date, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, directory, end]);
}

export function readZipEntries(zipBuffer) {
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= zipBuffer.length && zipBuffer.readUInt32LE(offset) === 0x04034b50) {
    const method = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const uncompressedSize = zipBuffer.readUInt32LE(offset + 22);
    const nameLength = zipBuffer.readUInt16LE(offset + 26);
    const extraLength = zipBuffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > zipBuffer.length) throw new Error("ZIP_MEMBER_OUT_OF_BOUNDS");
    const name = zipBuffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const compressed = zipBuffer.subarray(dataStart, dataEnd);
    const data = method === 8 ? inflateRawSync(compressed) : method === 0 ? compressed : null;
    if (!data || data.length !== uncompressedSize) throw new Error(`ZIP_MEMBER_INVALID:${name}`);
    entries.set(name, data);
    offset = dataEnd;
  }
  return entries;
}
