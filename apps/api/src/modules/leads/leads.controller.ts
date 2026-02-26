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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadScoreService } from './services/lead-score.service';
import { CreateLeadDto, CreateLeadSchema } from './dto/create-lead.dto';
import { UpdateLeadDto, UpdateLeadSchema } from './dto/update-lead.dto';
import { ConvertLeadDto, convertLeadSchema } from './dto/convert-lead.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole, LeadStatus, ProductType } from '@prisma/client';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { AuthUser } from '@/common/interfaces/auth-user.interface';

/**
 * Leads Controller
 * Endpoints para gerenciar leads de vendas
 *
 * PERMISSÕES:
 * - GET: Todos usuários autenticados (com scoping por role)
 * - POST: Todos usuários autenticados (vendedor cria para si mesmo)
 * - PUT: Dono do lead ou superiores (admins/gestor)
 * - DELETE: Apenas SUPERADMIN e ADMINISTRATIVO
 *
 * SCOPING:
 * - SUPERADMIN/ADMINISTRATIVO: Veem todos os leads
 * - GESTOR: Vê leads da sua equipe
 * - VENDEDOR: Vê apenas seus próprios leads
 */
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly leadScoreService: LeadScoreService,
  ) {}

  /**
   * GET /leads
   * Lista leads (com scoping por role)
   *
   * Query params:
   * - status?: LeadStatus
   * - productType?: ProductType
   * - origin?: LeadOrigin
   * - vendedorId?: string (apenas admins/gestor)
   */
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: LeadStatus,
    @Query('productType') productType?: ProductType,
    @Query('origin') origin?: string,
    @Query('vendedorId') vendedorId?: string,
  ) {
    return this.leadsService.findAll({
      currentUserId: user.id,
      currentUserRole: user.role,
      status,
      productType,
      origin,
      vendedorId,
    });
  }

  /**
   * GET /leads/my
   * Lista leads do usuário logado
   */
  @Get('my')
  async findMy(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: LeadStatus,
    @Query('productType') productType?: ProductType,
  ) {
    return this.leadsService.findAll({
      currentUserId: user.id,
      currentUserRole: user.role,
      status,
      productType,
      vendedorId: user.id,
    });
  }

  /**
   * GET /leads/cities/search
   * Busca cidades na API IBGE para autocomplete
   */
  @Get('cities/search')
  async searchCities(@Query('q') query: string) {
    return this.leadsService.searchCities(query);
  }

  /**
   * GET /leads/origins
   * Lista todas as origens de leads ativas
   */
  @Get('origins')
  async getOrigins() {
    return this.leadsService.getOrigins();
  }

  /**
   * GET /leads/check-duplicate-cnpj/:cnpj
   * Verifica se CNPJ já existe no sistema (leads ou clientes)
   * Usado para validação preventiva no formulário
   */
  @Get('check-duplicate-cnpj/:cnpj')
  async checkDuplicateCnpj(@Param('cnpj') cnpj: string) {
    return this.leadsService.checkDuplicateCnpj(cnpj);
  }

  /**
   * GET /leads/:id
   * Busca lead por ID (com validação de acesso)
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.leadsService.findOne(id, user.id, user.role);
  }

  /**
   * POST /leads
   * Cria um novo lead
   *
   * REGRAS:
   * - VENDEDOR cria lead para si mesmo (vendedorId ignorado)
   * - GESTOR pode criar para seus vendedores
   * - SUPERADMIN/ADMINISTRATIVO podem criar para qualquer vendedor
   */
  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateLeadSchema)) dto: CreateLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.create(dto, user.id, user.role);
  }

  /**
   * PATCH /leads/:id
   * Atualiza um lead (usado pelo frontend Kanban drag-and-drop)
   *
   * REGRAS:
   * - Dono pode atualizar seus leads
   * - GESTOR pode atualizar leads da equipe
   * - SUPERADMIN/ADMINISTRATIVO podem atualizar qualquer lead
   * - Lead PERDIDO não pode ser editado
   * - Lead GANHO só pode ser editado por admins
   */
  @Patch(':id')
  async updatePatch(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateLeadSchema)) dto: UpdateLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.update(id, dto, user.id, user.role);
  }

  /**
   * PUT /leads/:id
   * Atualiza um lead (mantido para compatibilidade)
   *
   * REGRAS:
   * - Dono pode atualizar seus leads
   * - GESTOR pode atualizar leads da equipe
   * - SUPERADMIN/ADMINISTRATIVO podem atualizar qualquer lead
   * - Lead PERDIDO não pode ser editado
   * - Lead GANHO só pode ser editado por admins
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateLeadSchema)) dto: UpdateLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.update(id, dto, user.id, user.role);
  }

  /**
   * POST /leads/:id/convert
   * Converte lead em cliente com dados estratégicos
   *
   * REQUER: Dono do lead ou superior
   * IMPORTANTE: Trava inteligente - requer dados estratégicos obrigatórios
   */
  @Post(':id/convert')
  async convert(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(convertLeadSchema)) dto: ConvertLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.convert(id, dto, user.id);
  }

  /**
   * POST /leads/:id/generate-summary
   * Gera resumo da negociação usando IA (ou fallback simples)
   *
   * REQUER: Dono do lead ou superior
   * @param id - ID do lead
   * @param body - Optional: { planId?: string } para usar plano específico
   */
  @Post(':id/generate-summary')
  async generateSummary(@Param('id') id: string, @Body() body?: { planId?: string }) {
    return this.leadsService.generateSummary(id, body?.planId);
  }

  /**
   * GET /leads/:id/score
   * Retorna score detalhado do lead com 6 fatores
   *
   * REQUER: Usuário autenticado
   */
  @Get(':id/score')
  async getScore(@Param('id') id: string) {
    return this.leadScoreService.updateLeadScore(id);
  }

  /**
   * POST /leads/:id/interactions
   * Adiciona interação à linha do tempo do lead
   */
  @Post(':id/interactions')
  async addInteraction(
    @Param('id') id: string,
    @Body() body: { content: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.addInteraction(id, user.id, body.content);
  }

  /**
   * DELETE /leads/:id
   * Deleta um lead
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   * IMPORTANTE: Não pode deletar lead convertido (GANHO)
   */
  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.leadsService.remove(id, user.id, user.role);
  }
}
