import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, CreateUserSchema } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserSchema } from './dto/update-user.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { AuthUser } from '@/common/interfaces/auth-user.interface';

/**
 * Users Controller
 * Endpoints para gerenciar usuários do sistema
 *
 * PERMISSÕES:
 * - GET (listar/visualizar): Todos usuários autenticados (com scoping por role)
 * - POST: Apenas SUPERADMIN e ADMINISTRATIVO
 * - PUT: Usuário pode editar a si mesmo, admins podem editar qualquer um
 * - DELETE/RESTORE: Apenas SUPERADMIN e ADMINISTRATIVO
 *
 * SCOPING:
 * - SUPERADMIN/ADMINISTRATIVO: Veem todos os usuários
 * - GESTOR: Vê apenas usuários da sua equipe
 * - VENDEDOR/DESENVOLVEDOR: Vê apenas a si mesmo
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users
   * Lista usuários (com scoping por role)
   *
   * Query params:
   * - role?: UserRole
   * - isActive?: boolean
   */
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: string,
  ) {
    return this.usersService.findAll({
      currentUserId: user.id,
      currentUserRole: user.role,
      role,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  /**
   * GET /users/me
   * Retorna dados do usuário logado
   */
  @Get('me')
  async getProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.findOne(user.id, user.id, user.role);
  }

  /**
   * GET /users/:id
   * Busca usuário por ID (com validação de acesso)
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.findOne(id, user.id, user.role);
  }

  /**
   * GET /users/email/:email
   * Busca usuario por email
   * Apenas SUPERADMIN e ADMINISTRATIVO
   */
  @Get('email/:email')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async findByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  /**
   * POST /users
   * Cria um novo usuário manualmente
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   * NOTA: Normalmente usuários são criados via webhook do Clerk
   */
  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  @UsePipes(new ZodValidationPipe(CreateUserSchema))
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  /**
   * PUT /users/:id
   * Atualiza um usuário
   *
   * REGRAS:
   * - Usuário pode atualizar a si mesmo (exceto role)
   * - SUPERADMIN/ADMINISTRATIVO podem atualizar qualquer usuário
   * - GESTOR pode atualizar seus vendedores
   */
  @Put(':id')
  @UsePipes(new ZodValidationPipe(UpdateUserSchema))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.update(id, dto, user.id, user.role);
  }

  /**
   * PUT /users/me
   * Atualiza dados do usuário logado
   */
  @Put('me')
  @UsePipes(new ZodValidationPipe(UpdateUserSchema))
  async updateProfile(@Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.update(user.id, dto, user.id, user.role);
  }

  /**
   * PATCH /users/:id/password
   * Altera senha do usuario
   *
   * REGRAS:
   * - Usuario pode alterar sua propria senha (precisa da senha atual)
   * - SUPERADMIN pode alterar senha de qualquer usuario (sem senha atual)
   * v2.54.0: Auth proprio JWT
   */
  @Patch(':id/password')
  async updatePassword(
    @Param('id') id: string,
    @Body() body: { currentPassword: string; newPassword: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.updatePassword(
      id,
      body.currentPassword,
      body.newPassword,
      user.id,
      user.role,
    );
  }

  /**
   * DELETE /users/:id
   * Desativa um usuario (soft delete)
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   * IMPORTANTE:
   * - Nao pode desativar a si mesmo
   * - Nao permite desativar gestor com vendedores ativos
   */
  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.usersService.remove(id, user.id, user.role);
  }

  /**
   * POST /users/:id/restore
   * Reativa um usuário desativado
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   */
  @Post(':id/restore')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.restore(id, user.id, user.role);
  }
}
