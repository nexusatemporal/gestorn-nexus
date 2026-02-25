import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma/prisma.service';
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

  constructor(private readonly prisma: PrismaService) {}

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

    return user;
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

    // Hash da senha se fornecida
    const { password, ...userFields } = dto as any;
    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

    const user = await this.prisma.user.create({
      data: {
        ...userFields,
        ...(passwordHash && { passwordHash }),
      },
    });

    this.logger.log(`Usuario criado: ${user.name} (${user.email})`);
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

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    this.logger.log(`Senha alterada: ${updated.name} (${updated.email})`);
    return { message: 'Senha alterada com sucesso' };
  }

  /**
   * Soft delete - desativa o usuario
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
      throw new ForbiddenException('Apenas SUPERADMIN e ADMINISTRATIVO podem desativar usuários');
    }

    // Não pode desativar a si mesmo
    if (currentUserId === id) {
      throw new ConflictException('Você não pode desativar sua própria conta');
    }

    // Verificar se é gestor com vendedores ativos
    const vendedoresAtivos = await this.prisma.user.count({
      where: {
        gestorId: id,
        isActive: true,
      },
    });

    if (vendedoresAtivos > 0) {
      throw new ConflictException(
        `Não é possível desativar usuário com ${vendedoresAtivos} vendedor(es) ativo(s). Reatribua-os primeiro.`,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.warn(`⚠️ Usuário desativado: ${user.name} (${user.email})`);
    return updated;
  }

  /**
   * Reativar usuário
   */
  async restore(id: string, currentUserId: string, currentUserRole: UserRole) {
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
      throw new ForbiddenException('Apenas SUPERADMIN e ADMINISTRATIVO podem reativar usuários');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });

    this.logger.log(`✅ Usuário reativado: ${user.name} (${user.email})`);
    return updated;
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
