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

  if (!token) {
    res.status(401).json({ error: 'Authentication required. No authorization token provided.' });
    return;
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired authorization token' });
  }
}

/**
 * Extracts and verifies token from a WebSocket upgrade request
 */
export function authenticateWsRequest(req: IncomingMessage): AuthTokenPayload | null {
  try {
    const parsedUrl = url.parse(req.url || '', true);
    let token = parsedUrl.query.token as string | undefined;

    if (!token && req.headers['sec-websocket-protocol']) {
      const protocols = (req.headers['sec-websocket-protocol'] as string).split(',').map((p) => p.trim());
      // Look for a token in the subprotocols
      const tokenProto = protocols.find((p) => p.startsWith('token.'));
      if (tokenProto) {
        token = tokenProto.substring(6);
      }
    }

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7).trim();
    }

    if (!token) {
      return null;
    }

    return verifyToken(token);
  } catch {
    return null;
  }
}
