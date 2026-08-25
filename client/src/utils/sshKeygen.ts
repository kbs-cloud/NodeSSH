// Utility to generate and parse SSH keys in browser and format OpenSSH / PEM keys

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function formatPEM(base64: string, label: string): string {
  const lines = base64.match(/.{1,64}/g) || [base64];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

// Convert public key bytes to OpenSSH format
function encodeOpenSshString(str: string): Uint8Array {
  const bytes = new TextEncoder().encode(str);
  const len = bytes.length;
  const result = new Uint8Array(4 + len);
  new DataView(result.buffer).setUint32(0, len, false); // big endian
  result.set(bytes, 4);
  return result;
}

function encodeOpenSshBuffer(buf: Uint8Array): Uint8Array {
  const len = buf.length;
  const result = new Uint8Array(4 + len);
  new DataView(result.buffer).setUint32(0, len, false);
  result.set(buf, 4);
  return result;
}

// Helper to compute SHA256 fingerprint
export async function calculateFingerprint(publicKeyStr: string): Promise<string> {
  try {
    const parts = publicKeyStr.trim().split(/\s+/);
    const keyData = parts.length > 1 ? parts[1] : parts[0];
    const binary = window.atob(keyData);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const hashB64 = arrayBufferToBase64(hash).replace(/=+$/, '');
    return `SHA256:${hashB64}`;
  } catch (e) {
    return 'SHA256:invalid-or-unparseable-key';
  }
}

export async function generateEd25519KeyPair(comment: string = 'nodessh-user@local'): Promise<{
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  type: 'ed25519';
}> {
  // Check if subtle.generateKey supports Ed25519
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'Ed25519',
      },
      true,
      ['sign', 'verify']
    );

    const pubRaw = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privPkcs8 = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const keyTypeStr = 'ssh-ed25519';
    const typeBuf = encodeOpenSshString(keyTypeStr);
    const keyBuf = encodeOpenSshBuffer(new Uint8Array(pubRaw));
    
    const wirePub = new Uint8Array(typeBuf.length + keyBuf.length);
    wirePub.set(typeBuf, 0);
    wirePub.set(keyBuf, typeBuf.length);
    
    const pubB64 = arrayBufferToBase64(wirePub.buffer);
    const publicKey = `${keyTypeStr} ${pubB64} ${comment}`;
    const privateKey = formatPEM(arrayBufferToBase64(privPkcs8), 'PRIVATE KEY');
    const fingerprint = await calculateFingerprint(publicKey);

    return {
      publicKey,
      privateKey,
      fingerprint,
      type: 'ed25519',
    };
  } catch (err) {
    // Fallback: Generate an RSA 2048/4096 or high-entropy placeholder if browser lacks Ed25519 subtle crypto
    return generateRSAKeyPair(2048, comment) as any;
  }
}

export async function generateRSAKeyPair(
  modulusLength: 2048 | 4096 = 4096,
  comment: string = 'nodessh-user@local'
): Promise<{
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  type: 'rsa';
  bits: number;
}> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  const pubSpki = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privPkcs8 = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  // Extract modulus and exponent from SPKI or format standard OpenSSH RSA public key
  const keyTypeStr = 'ssh-rsa';
  const typeBuf = encodeOpenSshString(keyTypeStr);
  const exponentBuf = encodeOpenSshBuffer(new Uint8Array([0x01, 0x00, 0x01]));
  
  // Approximate raw SPKI payload wrap
  const spkiBytes = new Uint8Array(pubSpki);
  // Extract raw modulus bytes (SPKI header is usually 33 bytes for RSA)
  const rawModulus = spkiBytes.slice(33);
  const modulusBuf = encodeOpenSshBuffer(rawModulus);

  const wirePub = new Uint8Array(typeBuf.length + exponentBuf.length + modulusBuf.length);
  wirePub.set(typeBuf, 0);
  wirePub.set(exponentBuf, typeBuf.length);
  wirePub.set(modulusBuf, typeBuf.length + exponentBuf.length);

  const pubB64 = arrayBufferToBase64(wirePub.buffer);
  const publicKey = `${keyTypeStr} ${pubB64} ${comment}`;
  const privateKey = formatPEM(arrayBufferToBase64(privPkcs8), 'RSA PRIVATE KEY');
  const fingerprint = await calculateFingerprint(publicKey);

  return {
    publicKey,
    privateKey,
    fingerprint,
    type: 'rsa',
    bits: modulusLength,
  };
}

export function parsePuTTYKey(content: string): {
  isPPK: boolean;
  keyType?: string;
  comment?: string;
} {
  if (content.includes('PuTTY-User-Key-File-')) {
    const typeMatch = content.match(/PuTTY-User-Key-File-\d+:\s*(.+)/);
    const commentMatch = content.match(/Comment:\s*(.+)/);
    return {
      isPPK: true,
      keyType: typeMatch ? typeMatch[1].trim() : 'ssh-rsa',
      comment: commentMatch ? commentMatch[1].trim() : '',
    };
  }
  return { isPPK: false };
}
