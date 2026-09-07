import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.schema';

export interface SessionClaims {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface IssuedToken {
  token: string;
  /** Absolute expiry read back off the signed token, so the cookie cannot outlive it. */
  expiresAt: Date;
}

/**
 * Session tokens (§12.2).
 *
 * Uses `jsonwebtoken` directly rather than `@nestjs/jwt`, which is ESM-only from
 * v12 and cannot be required by this CommonJS + Jest application. `@nestjs/jwt`
 * is a thin wrapper over this very library, so nothing is lost but dependency
 * injection sugar — which this class provides instead.
 *
 * The algorithm is pinned on **both** sides. Without `algorithms` on verify, a
 * token could be presented signed with a weaker algorithm, or with `alg: none`.
 */
@Injectable()
export class TokenService {
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly expiresIn: string;

  constructor(config: ConfigService<Env, true>) {
    this.secret = config.get('JWT_SECRET', { infer: true });
    this.issuer = config.get('JWT_ISSUER', { infer: true });
    this.audience = config.get('JWT_AUDIENCE', { infer: true });
    this.expiresIn = config.get('JWT_EXPIRES_IN', { infer: true });
  }

  issue(userId: string): IssuedToken {
    const token = jwt.sign({}, this.secret, {
      subject: userId,
      // A random id per session, so a future revocation list has something to
      // name. Nothing consults it yet — §12.2 defers revocation.
      jwtid: randomUUID(),
      issuer: this.issuer,
      audience: this.audience,
      // Env validation guarantees a `ms`-style duration string.
      expiresIn: this.expiresIn as SignOptions['expiresIn'],
      algorithm: 'HS256',
    });

    const decoded = jwt.decode(token);
    const exp =
      decoded && typeof decoded === 'object' && typeof decoded.exp === 'number' ? decoded.exp : 0;

    return { token, expiresAt: new Date(exp * 1000) };
  }

  /** Returns the claims, or null for any invalid, expired or mis-issued token. */
  verify(token: string): SessionClaims | null {
    try {
      const claims = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
      });

      if (typeof claims === 'string' || typeof claims.sub !== 'string') return null;

      return claims as SessionClaims;
    } catch {
      // Signature, expiry, issuer and audience failures are all the same to the
      // caller: no session. Distinguishing them would leak why to an attacker.
      return null;
    }
  }
}
