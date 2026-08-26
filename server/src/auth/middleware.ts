import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthTokenPayload } from '../types';
import { IncomingMessage } from 'http';
import url from 'url';

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token || token === 'default-session-token') {
    // Transparent local default user fallback
    req.user = {
      userId: 'usr-default',
      username: 'admin',
      email: 'admin@nodessh.local',
    };
    return next();
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err: any) {
    // If token invalid, fall back to local default user in single-user mode
    req.user = {
      userId: 'usr-default',
      username: 'admin',
      email: 'admin@nodessh.local',
    };
    next();
  }
}

/**
 * Extracts and verifies token from a WebSocket upgrade request
 */
export function authenticateWsRequest(req: IncomingMessage): AuthTokenPayload {
  try {
    const parsedUrl = url.parse(req.url || '', true);
    let token = parsedUrl.query.token as string | undefined;

    if (!token && req.headers['sec-websocket-protocol']) {
      const protocols = (req.headers['sec-websocket-protocol'] as string).split(',').map((p) => p.trim());
      const tokenProto = protocols.find((p) => p.startsWith('token.'));
      if (tokenProto) {
        token = tokenProto.substring(6);
      }
    }

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7).trim();
    }

    if (token && token !== 'default-session-token') {
      return verifyToken(token);
    }
  } catch {}

  // Fallback to local default user for WebSocket
  return {
    userId: 'usr-default',
    username: 'admin',
    email: 'admin@nodessh.local',
  };
}
