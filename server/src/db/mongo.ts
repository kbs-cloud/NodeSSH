import { MongoClient, Db, Collection } from 'mongodb';
import { config } from '../config';
import { User, ServerProfile, SshKey, SshTunnel, Snippet, UserSettings } from '../types';

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

export async function connectMongo(uri?: string): Promise<Db> {
  if (mongoDb) return mongoDb;

  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nodessh';
  const client = new MongoClient(mongoUri);
  await client.connect();

  const dbName = mongoUri.split('/').pop()?.split('?')[0] || 'nodessh';
  const db = client.db(dbName);

  // Initialize indexes
  await db.collection('users').createIndex({ username: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
  await db.collection('users').createIndex({ sso_id: 1 }, { unique: true, sparse: true });
  await db.collection('users').createIndex({ email: 1 }, { sparse: true });

  await db.collection('profiles').createIndex({ user_id: 1, name: 1 });
  await db.collection('ssh_keys').createIndex({ user_id: 1 });
  await db.collection('tunnels').createIndex({ user_id: 1 });
  await db.collection('snippets').createIndex({ user_id: 1 });
  await db.collection('settings').createIndex({ user_id: 1 }, { unique: true });

  mongoClient = client;
  mongoDb = db;
  console.log(`[NodeSSH] 🍃 Connected to MongoDB database: ${dbName}`);
  return mongoDb;
}

export function getMongoDb(): Db | null {
  return mongoDb;
}

export function isMongoActive(): boolean {
  return process.env.DB_TYPE === 'mongodb' || !!process.env.MONGODB_URI;
}

export async function closeMongo(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
  }
}
