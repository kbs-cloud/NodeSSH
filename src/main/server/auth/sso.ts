import { Request, Response } from 'express';
import { config } from '../config';
import { findUserBySsoId, findUserByUsername, createUser, updateUser, toUserDTO } from '../db/users';
import { generateToken } from './middleware';

export function getSSOConfig() {
  return {
    clientId: config.kbs.clientId,
    authServerUrl: config.kbs.authServerUrl,
    hubUrl: config.kbs.hubUrl,
  };
}

/**
 * Handles SSO Callback from KBS Cloud Auth Server
 */
export async function handleSSOCallback(req: Request, res: Response): Promise<void> {
  try {
    const isIframe = req.query.source === 'iframe';
    const ssoId = (req.query.sso_id || req.query.sub || req.query.id || req.body?.sso_id) as string | undefined;
    const username = (req.query.username || req.query.name || req.body?.username || `user_${Math.random().toString(36).substring(2, 8)}`) as string;
    const email = (req.query.email || req.body?.email) as string | undefined;

    // If ssoId is missing, generate or use code
    const effectiveSsoId = ssoId || (req.query.code as string) || `sso_${username}`;

    let user = findUserBySsoId(effectiveSsoId);

    if (!user) {
      // Check if username collision exists
      let finalUsername = username;
      const existingUser = findUserByUsername(finalUsername);
      if (existingUser && !existingUser.sso_id) {
        // Link existing local account to SSO
        user = updateUser(existingUser.id, { sso_id: effectiveSsoId, email: email || existingUser.email });
      } else if (existingUser) {
        finalUsername = `${username}_${Math.random().toString(36).substring(2, 6)}`;
        user = createUser({
          username: finalUsername,
          sso_id: effectiveSsoId,
          email: email || null,
        });
      } else {
        user = createUser({
          username: finalUsername,
          sso_id: effectiveSsoId,
          email: email || null,
        });
      }
    }

    if (!user) {
      res.status(500).send('Failed to provision or find user account');
      return;
    }

    const userDTO = toUserDTO(user);
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    if (isIframe) {
      // Respond with HTML snippet that posts message to parent window
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>SSO Login</title></head>
        <body>
          <script>
            (function() {
              var payload = {
                type: 'SSO_LOGIN_SUCCESS',
                token: ${JSON.stringify(token)},
                user: ${JSON.stringify(userDTO)}
              };
              if (window.parent && window.parent !== window) {
                window.parent.postMessage(payload, '*');
              }
            })();
          </script>
        </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      return;
    }

    // Direct browser redirect to application frontend with token
    res.redirect(`/?token=${encodeURIComponent(token)}`);
  } catch (err: any) {
    res.status(500).json({ error: `SSO callback error: ${err.message}` });
  }
}
