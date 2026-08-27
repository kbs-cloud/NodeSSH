import crypto from 'crypto';
import { KeyType } from '../types';

export interface GeneratedKeyPair {
  privateKey: string;
  publicKey: string;
  fingerprint: string;
  keyType: KeyType;
}

function toSSHString(buf: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(buf.length);
  return Buffer.concat([len, buf]);
}

function toSSHmpint(buf: Buffer): Buffer {
  if (buf[0] & 0x80) {
    const padded = Buffer.concat([Buffer.from([0x00]), buf]);
    return toSSHString(padded);
  }
  return toSSHString(buf);
}

/**
 * Calculates standard OpenSSH SHA256 fingerprint from an OpenSSH public key string
 */
export function calculateFingerprint(publicKeyStr: string): string {
  try {
    const parts = publicKeyStr.trim().split(/\s+/);
    if (parts.length < 2) {
      throw new Error('Invalid OpenSSH public key format');
    }
    const wireBuffer = Buffer.from(parts[1], 'base64');
    const hash = crypto.createHash('sha256').update(wireBuffer).digest('base64').replace(/=+$/, '');
    return `SHA256:${hash}`;
  } catch (err: any) {
    return 'SHA256:unknown';
  }
}

/**
 * Generates an Ed25519 SSH Keypair
 */
export function generateEd25519Key(comment: string = 'nodessh-key'): GeneratedKeyPair {
  const { publicKey: pubDer, privateKey: privPem } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // The last 32 bytes of DER SPKI for ed25519 is the raw public key
  const rawPub = pubDer.subarray(pubDer.length - 32);
  const typeName = Buffer.from('ssh-ed25519');
  const wire = Buffer.concat([
    toSSHString(typeName),
    toSSHString(rawPub),
  ]);

  const pubB64 = wire.toString('base64');
  const publicKey = `ssh-ed25519 ${pubB64} ${comment}`;
  const fingerprint = calculateFingerprint(publicKey);

  return {
    privateKey: privPem,
    publicKey,
    fingerprint,
    keyType: 'ed25519',
  };
}

/**
 * Generates an RSA (2048 or 4096 bit) SSH Keypair
 */
export function generateRSAKey(bits: number = 4096, comment: string = 'nodessh-key'): GeneratedKeyPair {
  const { publicKey: pubPem, privateKey: privPem } = crypto.generateKeyPairSync('rsa', {
    modulusLength: bits,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const keyObj = crypto.createPublicKey(pubPem);
  const jwk = keyObj.export({ format: 'jwk' });

  const eBuf = Buffer.from(jwk.e || '', 'base64url');
  const nBuf = Buffer.from(jwk.n || '', 'base64url');

  const typeStr = toSSHString(Buffer.from('ssh-rsa'));
  const exp = toSSHmpint(eBuf);
  const mod = toSSHmpint(nBuf);
  const wire = Buffer.concat([typeStr, exp, mod]);

  const pubB64 = wire.toString('base64');
  const publicKey = `ssh-rsa ${pubB64} ${comment}`;
  const fingerprint = calculateFingerprint(publicKey);

  return {
    privateKey: privPem,
    publicKey,
    fingerprint,
    keyType: 'rsa',
  };
}

/**
 * Generates SSH keypair based on specified type
 */
export function generateSSHKeyPair(
  type: KeyType = 'ed25519',
  bits: number = 4096,
  comment: string = 'nodessh-key'
): GeneratedKeyPair {
  if (type === 'ed25519') {
    return generateEd25519Key(comment);
  }
  return generateRSAKey(bits, comment);
}
