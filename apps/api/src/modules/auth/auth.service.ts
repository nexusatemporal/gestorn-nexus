import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        avatar: true,
        passwordHash: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    if (!user.passwordHash) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return null;
    }

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async login(user: { id: string; email: string; name: string; role: string; isActive: boolean; avatar?: string | null }) {
    const payload = { sub: user.id, email: user.email };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'fallback-secret-change-in-prod',
      expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as any,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-change-in-prod',
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
    });

    // Salvar refresh token hash no banco
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshTokenHash,
        lastLoginAt: new Date(),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        avatar: user.avatar,
      },
    };
  }

  async refreshTokens(rawRefreshToken: string) {
    let payload: { sub: string; email: string };

    try {
      payload = this.jwtService.verify(rawRefreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-change-in-prod',
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalido ou expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        avatar: true,
        refreshToken: true,
      },
    });

    if (!user || !user.isActive || !user.refreshToken) {
      throw new UnauthorizedException('Usuario nao encontrado ou sessao invalida');
    }

    const isRefreshValid = await bcrypt.compare(rawRefreshToken, user.refreshToken);
    if (!isRefreshValid) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    const newPayload = { sub: user.id, email: user.email };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newAccessToken = this.jwtService.sign(newPayload, {
      secret: process.env.JWT_SECRET || 'fallback-secret-change-in-prod',
      expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as any,
    });

    return { accessToken: newAccessToken };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: 'Logout realizado com sucesso' };
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        avatar: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }
}
