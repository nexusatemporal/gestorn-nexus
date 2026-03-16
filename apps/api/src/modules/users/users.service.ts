import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/modules/mail/mail.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '@prisma/client';

/**
 * Users Service
 * Gerencia usuários do sistema com controle de acesso baseado em roles
 *
 * REGRAS DE ACESSO:
 * - SUPERADMIN: Acesso total a todos os usuários
 * - ADMINISTRATIVO: Acesso total a todos os usuários
 * - GESTOR: Pode ver usuários da sua equipe (vendedores vinculados)
 * - VENDEDOR: Pode ver apenas seu próprio perfil
 * - DESENVOLVEDOR: Pode ver apenas seu próprio perfil
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Listar usuários (com scoping por role)
   */
  async findAll(params: {
    currentUserId: string;
    currentUserRole: UserRole;
    role?: UserRole;
    isActive?: boolean;
  }) {
    const { currentUserId, currentUserRole, role, isActive } = params;

    // Construir filtros baseado na role
    const where: any = {
      role,
      isActive,
    };

    // GESTOR: Ver apenas usuários da sua equipe
    if (currentUserRole === UserRole.GESTOR) {
      where.OR = [
        { id: currentUserId }, // Ver a si mesmo
        { gestorId: currentUserId }, // Ver seus vendedores
      ];
    }

    // VENDEDOR/DESENVOLVEDOR: Ver apenas a si mesmo
    if (
      currentUserRole === UserRole.VENDEDOR ||
      currentUserRole === UserRole.DESENVOLVEDOR
    ) {
      where.id = currentUserId;
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        gestorId: true,
        // Relações
        gestor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            assignedClients: true,
            assignedLeads: true,
            vendedores: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Buscar usuário por ID (com validação de acesso)
   */
  async findOne(id: string, currentUserId: string, currentUserRole: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        gestor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        vendedores: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
          where: { isActive: true },
        },
        _count: {
          select: {
            assignedClients: true,
            assignedLeads: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuário ${id} não encontrado`);
    }

    // Validar acesso
    this.validateAccess(user.id, user.gestorId, currentUserId, currentUserRole);

    // Remover campos sensíveis
    const { passwordHash, refreshToken, tokenVersion, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Buscar usuario por email
   */
  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com email ${email} não encontrado`);
    }

    return user;
  }

  /**
   * Criar usuario
   * v2.54.0: Auth proprio JWT (sem Clerk)
   */
  async create(dto: CreateUserDto) {
    // Verificar se email ja existe
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingEmail) {
      throw new ConflictException(`Usuario com email ${dto.email} ja existe`);
    }

    // Validar gestorId se fornecido
    if (dto.gestorId) {
      const gestor = await this.prisma.user.findUnique({
        where: { id: dto.gestorId },
      });

      if (!gestor) {
        throw new NotFoundException(`Gestor ${dto.gestorId} nao encontrado`);
      }

      if (gestor.role !== UserRole.GESTOR) {
        throw new ConflictException('O usuario informado nao e um GESTOR');
      }
    }

    // Gerar senha forte automaticamente se não fornecida
    const { password: dtoPassword, phone, ...userFields } = dto as any;
    const password = dtoPassword || this.generateStrongPassword();
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        ...userFields,
        passwordHash,
      },
    });

    this.logger.log(`Usuario criado: ${user.name} (${user.email})`);

    // Enviar email de boas-vindas com credenciais (senha sempre presente)
    this.mail.sendWelcomeEmail({
      to: user.email,
      name: user.name,
      password,
      role: user.role,
    });

    return user;
  }

  /**
   * Atualizar usuário (com validação de acesso)
   */
  async update(
    id: string,
    dto: UpdateUserDto,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Usuário ${id} não encontrado`);
    }

    // Validar acesso
    this.validateAccess(user.id, user.gestorId, currentUserId, currentUserRole);

    // Usuário comum não pode alterar seu próprio role
    if (
      currentUserId === id &&
      dto.role &&
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.ADMINISTRATIVO
    ) {
      throw new ForbiddenException('Você não pode alterar sua própria role');
    }

    // Validar gestorId se fornecido
    if (dto.gestorId !== undefined) {
      if (dto.gestorId) {
        const gestor = await this.prisma.user.findUnique({
          where: { id: dto.gestorId },
        });

        if (!gestor) {
          throw new NotFoundException(`Gestor ${dto.gestorId} não encontrado`);
        }

        if (gestor.role !== UserRole.GESTOR) {
          throw new ConflictException('O usuário informado não é um GESTOR');
        }
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Usuario atualizado: ${updated.name} (${updated.email})`);
    return updated;
  }

  /**
   * Alterar senha do usuario
   * v2.54.0: Auth proprio JWT
   */
  async updatePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, passwordHash: true, gestorId: true },
    });

    if (!user) {
      throw new NotFoundException(`Usuario ${id} nao encontrado`);
    }

    // Validar acesso (apenas o proprio usuario ou SUPERADMIN)
    if (currentUserId !== id && currentUserRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Voce nao pode alterar a senha de outro usuario');
    }

    // Verificar senha atual (exceto SUPERADMIN alterando senha de outro)
    if (currentUserId === id) {
      if (!user.passwordHash) {
        throw new ForbiddenException('Usuario nao possui senha cadastrada');
      }
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        throw new ForbiddenException('Senha atual incorreta');
      }
    }

    // Validação robusta da nova senha
    this.validatePasswordStrength(newPassword, user.name, user.email);

    // Não permitir reutilizar a mesma senha
    if (user.passwordHash) {
      const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
      if (isSamePassword) {
        throw new ConflictException('A nova senha não pode ser igual à senha atual');
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { passwordHash, tokenVersion: { increment: 1 }, refreshToken: null },
    });

    this.logger.log(`Senha alterada: ${updated.name} (${updated.email})`);
    return { message: 'Senha alterada com sucesso' };
  }

  /**
   * Validação robusta de força de senha
   */
  private validatePasswordStrength(password: string, userName: string, userEmail: string) {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Mínimo de 8 caracteres');
    }
    if (password.length > 128) {
      errors.push('Máximo de 128 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Pelo menos uma letra maiúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Pelo menos uma letra minúscula');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Pelo menos um número');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      errors.push('Pelo menos um caractere especial (!@#$%^&*...)');
    }

    // Não pode conter o nome do usuário
    const nameParts = userName.toLowerCase().split(/\s+/);
    const passwordLower = password.toLowerCase();
    for (const part of nameParts) {
      if (part.length >= 3 && passwordLower.includes(part)) {
        errors.push('Não pode conter seu nome ou partes do nome');
        break;
      }
    }

    // Não pode conter o email (parte antes do @)
    const emailLocal = userEmail.split('@')[0].toLowerCase();
    if (emailLocal.length >= 3 && passwordLower.includes(emailLocal)) {
      errors.push('Não pode conter seu email');
    }

    // Não pode ser sequência comum
    const commonPatterns = ['12345678', 'abcdefgh', 'qwertyui', 'password', 'senhanexus', 'nexus123'];
    for (const pattern of commonPatterns) {
      if (passwordLower.includes(pattern)) {
        errors.push('Não pode conter sequências comuns');
        break;
      }
    }

    if (errors.length > 0) {
      throw new ConflictException(`Senha fraca: ${errors.join('; ')}`);
    }
  }

  /**
   * Hard delete - exclui o usuario permanentemente
   * Remove todas as relações e o registro do banco
   */
  async remove(id: string, currentUserId: string, currentUserRole: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Usuário ${id} não encontrado`);
    }

    // Validar acesso (apenas SUPERADMIN e ADMINISTRATIVO)
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.ADMINISTRATIVO
    ) {
      throw new ForbiddenException('Apenas SUPERADMIN e ADMINISTRATIVO podem excluir usuários');
    }

    // Não pode excluir a si mesmo
    if (currentUserId === id) {
      throw new ConflictException('Você não pode excluir sua própria conta');
    }

    // Verificar se é gestor com vendedores vinculados
    const vendedoresVinculados = await this.prisma.user.count({
      where: { gestorId: id },
    });

    if (vendedoresVinculados > 0) {
      throw new ConflictException(
        `Não é possível excluir usuário com ${vendedoresVinculados} vendedor(es) vinculado(s). Reatribua-os primeiro.`,
      );
    }

    // Verificar se tem clientes atribuídos (vendedorId é obrigatório em Client)
    const clientesAtribuidos = await this.prisma.client.count({
      where: { vendedorId: id },
    });

    if (clientesAtribuidos > 0) {
      throw new ConflictException(
        `Não é possível excluir usuário com ${clientesAtribuidos} cliente(s) atribuído(s). Reatribua-os primeiro.`,
      );
    }

    // Hard delete em transação
    await this.prisma.$transaction(async (tx) => {
      // Desvincula leads (vendedorId é opcional)
      await tx.lead.updateMany({
        where: { vendedorId: id },
        data: { vendedorId: null },
      });

      // Desvincula interactions
      await tx.interaction.deleteMany({
        where: { userId: id },
      });

      // Desvincula impersonate logs
      await tx.impersonateLog.deleteMany({
        where: { userId: id },
      });

      // Nullifica FK opcional em payments
      await tx.payment.updateMany({
        where: { createdById: id },
        data: { createdById: null },
      });

      // Nullifica FK em audit logs
      await tx.auditLog.updateMany({
        where: { userId: id },
        data: { userId: null },
      });

      // Nullifica FK em chat messages
      await tx.chatMessage.updateMany({
        where: { senderId: id },
        data: { senderId: null },
      });

      // Nullifica FK em finance transactions (createdBy agora é opcional)
      await tx.financeTransaction.updateMany({
        where: { createdBy: id },
        data: { createdBy: null },
      });

      // Relações com onDelete: Cascade são removidas automaticamente pelo Prisma:
      // UserPermission, CalendarEvent, GoogleCalendarToken, Notification,
      // NotificationPreference, AIConversation, Form (FormCreator)

      // Nullifica FK em forms (defaultVendedorId, já tem onDelete: SetNull)

      // Exclui o usuário
      await tx.user.delete({
        where: { id },
      });
    });

    this.logger.warn(`🗑️ Usuário EXCLUÍDO permanentemente: ${user.name} (${user.email})`);
    return { message: 'Usuário excluído permanentemente' };
  }

  /**
   * Reenviar email de boas-vindas
   */
  async resendWelcomeEmail(id: string, currentUserRole: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      throw new NotFoundException(`Usuário ${id} não encontrado`);
    }

    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.ADMINISTRATIVO
    ) {
      throw new ForbiddenException('Apenas SUPERADMIN e ADMINISTRATIVO podem reenviar emails');
    }

    // Gerar nova senha e atualizar hash no banco
    const newPassword = this.generateStrongPassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, tokenVersion: { increment: 1 }, refreshToken: null },
    });

    await this.mail.sendWelcomeEmail({
      to: user.email,
      name: user.name,
      password: newPassword,
      role: user.role,
    });

    this.logger.log(`Email de boas-vindas reenviado para ${user.email} (senha resetada)`);
    return { message: `Email reenviado para ${user.email}` };
  }

  /**
   * Gera senha forte aleatória (16 chars) para novos usuários
   */
  private generateStrongPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const specials = '!@#$%&*';
    const all = upper + lower + digits + specials;

    const bytes = crypto.randomBytes(16);

    // Garantir pelo menos 1 de cada categoria nas primeiras 4 posições
    let pwd = '';
    pwd += upper[bytes[0] % upper.length];
    pwd += lower[bytes[1] % lower.length];
    pwd += digits[bytes[2] % digits.length];
    pwd += specials[bytes[3] % specials.length];

    // Preencher o restante com chars aleatórios
    for (let i = 4; i < 16; i++) {
      pwd += all[bytes[i] % all.length];
    }

    return pwd;
  }

  /**
   * Helper: Validar acesso a um usuário
   */
  private validateAccess(
    targetUserId: string,
    targetUserGestorId: string | null,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    // SUPERADMIN e ADMINISTRATIVO têm acesso total
    if (
      currentUserRole === UserRole.SUPERADMIN ||
      currentUserRole === UserRole.ADMINISTRATIVO
    ) {
      return;
    }

    // GESTOR pode acessar seus vendedores
    if (currentUserRole === UserRole.GESTOR) {
      if (targetUserId === currentUserId || targetUserGestorId === currentUserId) {
        return;
      }
    }

    // VENDEDOR/DESENVOLVEDOR pode acessar apenas a si mesmo
    if (targetUserId === currentUserId) {
      return;
    }

    throw new ForbiddenException('Você não tem permissão para acessar este usuário');
  }
}
