import { eq, and, gt, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../../db';
import { users, refreshTokens, tenants } from '../../db/schema';
import { errors } from '../../utils/errors';
import { JwtPayload, UserRole } from '@werkstatt/shared';

export class AuthService {
  async registerTenant(data: {
    workshopName: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  }) {
    // Check if email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });
    if (existingUser) {
      throw errors.conflict('Email already registered');
    }

    // Create tenant
    const [tenant] = await db.insert(tenants).values({
      name: data.workshopName,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      country: data.country || 'AT',
    }).returning();

    // Create owner user
    const passwordHash = await bcrypt.hash(data.password, 12);
    const [user] = await db.insert(users).values({
      tenantId: tenant.id,
      email: data.email,
      passwordHash,
      name: data.workshopName,
      role: 'owner',
    }).returning();

    return this.generateTokens(user.id, tenant.id, user.role as UserRole, user.email);
  }

  async login(email: string, password: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.isActive) {
      throw errors.unauthorized('Invalid email or password');
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw errors.unauthorized('Invalid email or password');
    }

    // Update last login
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    return this.generateTokens(user.id, user.tenantId, user.role as UserRole, user.email);
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
    } catch {
      throw errors.unauthorized('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await db.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date())
      ),
    });

    if (!stored) {
      throw errors.unauthorized('Refresh token revoked or expired');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user || !user.isActive) {
      throw errors.unauthorized('User not found');
    }

    // Revoke old refresh token (rotation)
    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, stored.id));

    return this.generateTokens(user.id, user.tenantId, user.role as UserRole, user.email);
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  private async generateTokens(userId: string, tenantId: string, role: UserRole, email: string) {
    const payload: JwtPayload = { sub: userId, tenantId, role, email };

    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    } as jwt.SignOptions);

    const refreshTokenValue = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    } as jwt.SignOptions);

    // Store hashed refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(refreshTokens).values({
      userId,
      tokenHash: this.hashToken(refreshTokenValue),
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: 900, // 15 minutes in seconds
      user: { id: userId, tenantId, role, email },
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

export const authService = new AuthService();
