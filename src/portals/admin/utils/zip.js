// Minimal ZIP reader / writer for .docx files, so the import needs no
// library. Writing stores entries uncompressed (Word opens that fine);
// reading handles stored and deflated entries (what Word produces) through
// the browser's built-in DecompressionStream.

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8");

let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// files: [{ name, text }] -> Uint8Array of a .zip
export function zipStore(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const push = (u8) => { chunks.push(u8); offset += u8.length; };
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = crc32(data);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 0x0800, true);   // UTF-8 names
    head.setUint16(8, 0, true);        // stored
    head.setUint32(14, crc, true);
    head.setUint32(18, data.length, true);
    head.setUint32(22, data.length, true);
    head.setUint16(26, name.length, true);
    central.push({ name, crc, size: data.length, offset });
    push(new Uint8Array(head.buffer)); push(name); push(data);
  }
  const cdStart = offset;
  for (const c of central) {
    const h = new DataView(new ArrayBuffer(46));
    h.setUint32(0, 0x02014b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 20, true);
    h.setUint16(8, 0x0800, true);
    h.setUint32(16, c.crc, true);
    h.setUint32(20, c.size, true);
    h.setUint32(24, c.size, true);
    h.setUint16(28, c.name.length, true);
    h.setUint32(42, c.offset, true);
    push(new Uint8Array(h.buffer)); push(c.name);
  }
  const cdSize = offset - cdStart;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, central.length, true);
  end.setUint16(10, central.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, cdStart, true);
  push(new Uint8Array(end.buffer));
  const out = new Uint8Array(offset);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open compressed Word files. Use a current Chrome, Edge, Safari or Firefox.");
  const source = new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } });
  const stream = source.pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Reads one entry of a .zip as text, or null when it is not there.
export async function unzipText(buffer, wanted) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("bad zip");
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    if (name === wanted) {
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const raw = u8.subarray(start, start + csize);
      if (method === 0) return dec.decode(raw);
      if (method === 8) return dec.decode(await inflateRaw(raw));
      throw new Error("unsupported zip method");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
