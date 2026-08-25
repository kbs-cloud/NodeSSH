import path from 'path';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || (process.env.NODE_ENV === 'production' ? '3000' : '3001'), 10),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'nodessh-super-secret-jwt-key-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  vaultEncryptionKey: process.env.VAULT_ENCRYPTION_KEY || 'nodessh-vault-master-key-32-byte',
  dbPath: process.env.DB_PATH 
    ? path.resolve(process.env.DB_PATH) 
    : path.resolve(__dirname, '../../data/nodessh.db'),
  kbs: {
    clientId: process.env.KBS_SSO_CLIENT_ID || 'nodessh',
    authServerUrl: process.env.KBS_AUTH_SERVER_URL || 'http://localhost:19001',
    hubUrl: process.env.KBS_HUB_URL || 'http://localhost:19000',
  },
  clientDistPath: process.env.CLIENT_DIST_PATH
    ? path.resolve(process.env.CLIENT_DIST_PATH)
    : path.resolve(__dirname, '../../../client/dist'),
  isProduction: process.env.NODE_ENV === 'production',
};
