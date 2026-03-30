import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { LeadScoreService } from './services/lead-score.service';
import { SubscriptionService } from '../subscriptions/subscriptions.service';
import { TenantsService } from '../tenants/tenants.service';
import { parseDateBrasilia, nowBrasilia } from '../../common/utils/date.utils';
import { UserRole, LeadStatus, ProductType, ClientStatus, BillingCycle, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Leads Service
 * Gerencia leads de vendas com controle de acesso baseado em roles
 *
 * REGRAS DE ACESSO:
 * - SUPERADMIN/ADMINISTRATIVO: Acesso total a todos os leads
 * - GESTOR: Acesso aos leads da sua equipe (vendedores vinculados)
 * - VENDEDOR: Acesso apenas aos seus próprios leads
 *
 * CONVERSÃO:
 * - Lead GANHO pode ser convertido em Client
 * - Lead PERDIDO não pode mais ser editado (apenas visualizado)
 */
@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadScoreService: LeadScoreService,
    private readonly subscriptionService: SubscriptionService,
    private readonly tenantsService: TenantsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Listar leads (com scoping por role)
   */
  async findAll(params: {
    currentUserId: string;
    currentUserRole: UserRole;
    status?: LeadStatus;
    productType?: ProductType;
    origin?: string;
    vendedorId?: string;
  }) {
    const { currentUserId, currentUserRole, status, productType, origin, vendedorId } = params;

    // Construir filtros baseado na role
    const where: any = {};
    if (status) where.status = status;
    if (productType) where.interestProduct = productType;
    if (origin) where.origin = { name: origin };

    // GESTOR: Ver apenas leads da sua equipe
    if (currentUserRole === UserRole.GESTOR) {
      // Buscar vendedores do gestor
      const vendedores = await this.prisma.user.findMany({
        where: { gestorId: currentUserId },
        select: { id: true },
      });

      const vendedorIds = vendedores.map((v) => v.id);
      vendedorIds.push(currentUserId); // Incluir leads do próprio gestor

      where.vendedorId = { in: vendedorIds };

      // Se filtrou por vendedorId, validar se pertence à equipe
      if (vendedorId && !vendedorIds.includes(vendedorId)) {
        throw new ForbiddenException('Você não tem acesso aos leads deste vendedor');
      }
    }

    // VENDEDOR: Ver apenas seus próprios leads
    if (currentUserRole === UserRole.VENDEDOR) {
      where.vendedorId = currentUserId;

      // Ignorar filtro de vendedorId se não for o próprio
      if (vendedorId && vendedorId !== currentUserId) {
        throw new ForbiddenException('Você só pode visualizar seus próprios leads');
      }
    }

    // SUPERADMIN/ADMINISTRATIVO podem filtrar por vendedorId livremente
    if (
      (currentUserRole === UserRole.SUPERADMIN ||
        currentUserRole === UserRole.ADMINISTRATIVO) &&
      vendedorId
    ) {
      where.vendedorId = vendedorId;
    }

    return this.prisma.lead.findMany({
      where,
      include: {
        vendedor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        interestPlan: {
          select: {
            id: true,
            name: true,
            product: true,
          },
        },
        origin: {
          select: {
            id: true,
            name: true,
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
            order: true,
            color: true,
          },
        },
        interactions: {
          select: {
            id: true,
            type: true,
            title: true,
            content: true,
            createdAt: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' as const },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Buscar lead por ID (com validação de acesso)
   */
  async findOne(id: string, currentUserId: string, currentUserRole: UserRole) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        vendedor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            gestor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        origin: {
          select: {
            id: true,
            name: true,
          },
        },
        interestPlan: {
          select: {
            id: true,
            name: true,
            product: true,
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
            order: true,
            color: true,
          },
        },
        interactions: {
          select: {
            id: true,
            type: true,
            title: true,
            content: true,
            createdAt: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' as const },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${id} não encontrado`);
    }

    // Validar acesso
    if (lead.vendedorId) {
      await this.validateAccess(lead.vendedorId, currentUserId, currentUserRole);
    }

    return lead;
  }

  /**
   * Criar lead
   */
  async create(dto: CreateLeadDto, currentUserId: string, currentUserRole: UserRole) {
    // TEMPORARY: Convert origin name to originId if needed
    if ((dto as any).origin && !(dto as any).originId) {
      const originName = (dto as any).origin;
      const leadOrigin = await this.prisma.leadOrigin.findFirst({
        where: { name: { contains: originName, mode: 'insensitive' } },
      });

      if (!leadOrigin) {
        throw new BadRequestException(`Origem "${originName}" não encontrada`);
      }

      (dto as any).originId = leadOrigin.id;
      delete (dto as any).origin; // Remove temporary field
    }

    // If stageId not provided, use default stage (Aberto)
    if (!(dto as any).stageId) {
      const defaultStage = await this.prisma.funnelStage.findFirst({
        where: { isDefault: true },
      });

      if (!defaultStage) {
        // Fallback: find stage with order=1
        const firstStage = await this.prisma.funnelStage.findFirst({
          where: { order: 1 },
        });

        if (!firstStage) {
          throw new BadRequestException('Nenhum estágio padrão encontrado no funil');
        }

        (dto as any).stageId = firstStage.id;
      } else {
        (dto as any).stageId = defaultStage.id;
      }
    }

    // Se vendedorId não foi fornecido, atribuir ao usuário atual
    // (Todos os usuários podem criar leads para si mesmos por padrão)
    if (!dto.vendedorId) {
      dto.vendedorId = currentUserId;
    }

    // VENDEDOR sempre cria lead para si mesmo (override se tentou especificar outro)
    if (currentUserRole === UserRole.VENDEDOR) {
      dto.vendedorId = currentUserId;
    }

    // Validar vendedor se fornecido
    let vendedor = null;
    if (dto.vendedorId) {
      // GESTOR pode criar lead para seus vendedores
      if (currentUserRole === UserRole.GESTOR) {
        // Verificar se vendedor pertence à equipe
        const checkVendedor = await this.prisma.user.findUnique({
          where: { id: dto.vendedorId },
        });

        if (!checkVendedor) {
          throw new NotFoundException(`Vendedor ${dto.vendedorId} não encontrado`);
        }

        if (checkVendedor.gestorId !== currentUserId && dto.vendedorId !== currentUserId) {
          throw new ForbiddenException('Você só pode criar leads para sua equipe');
        }
      }

      // Validar se vendedor existe e está ativo
      vendedor = await this.prisma.user.findUnique({
        where: { id: dto.vendedorId },
      });

      if (!vendedor) {
        throw new NotFoundException(`Vendedor ${dto.vendedorId} não encontrado`);
      }

      if (!vendedor.isActive) {
        throw new BadRequestException('Não é possível atribuir lead a vendedor inativo');
      }
    }

    // Validar plano se fornecido
    if (dto.interestPlanId) {
      const plan = await this.prisma.plan.findUnique({
        where: { id: dto.interestPlanId },
      });

      if (!plan) {
        throw new NotFoundException(`Plano ${dto.interestPlanId} não encontrado`);
      }

      // Validar se produto do plano corresponde
      if (plan.product !== dto.interestProduct) {
        throw new BadRequestException(
          `Plano ${plan.name} é para ${plan.product}, mas lead é para ${dto.interestProduct}`,
        );
      }
    }

    // Remove temporary fields before creating in database
    const { origin, ...createData } = dto as any;

    // ✅ CORREÇÃO v2.28.0: Retornar lead com TODAS as relations (igual findAll)
    const lead = await this.prisma.lead.create({
      data: createData,
      include: {
        vendedor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        interestPlan: {
          select: {
            id: true,
            name: true,
            product: true,
          },
        },
        origin: {
          select: {
            id: true,
            name: true,
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
            order: true,
            color: true,
          },
        },
      },
    });

    this.logger.log(
      `✅ Lead criado: ${lead.companyName || lead.name} (${lead.email})${vendedor ? ` - Vendedor: ${vendedor.name}` : ''}`,
    );

    // ✅ v2.29.0: Debug log para confirmar relations
    this.logger.debug(
      `Relations retornadas: vendedor=${!!lead.vendedor}, interestPlan=${!!lead.interestPlan}, origin=${!!lead.origin}, stage=${!!lead.stage}, role=${lead.role}`,
    );

    // ✅ v2.34.0: Calcular Lead Score automaticamente
    try {
      await this.leadScoreService.updateLeadScore(lead.id);
      this.logger.debug(`📊 Lead Score calculado para lead ${lead.id}`);
    } catch (error) {
      this.logger.warn(`⚠️ Erro ao calcular Lead Score: ${error.message}`);
      // Não falhar a criação do lead se o score falhar
    }

    // ✅ v2.58.0: Notificar vendedor sobre novo lead atribuído
    if (lead.vendedorId) {
      this.notificationsService.create({
        userId: lead.vendedorId,
        type: NotificationType.LEAD_ASSIGNED,
        title: 'Novo lead atribuído',
        message: `${lead.companyName || lead.name} (${lead.email}) foi atribuído a você.`,
        link: '/leads',
      }).catch(() => {}); // Fire-and-forget, não bloqueia

      // ✅ v2.60.0: Notificar gestor do vendedor sobre novo lead na equipe
      this.prisma.user.findUnique({
        where: { id: lead.vendedorId },
        select: { gestorId: true, name: true },
      }).then((vendedor) => {
        if (vendedor?.gestorId) {
          const vendedorNome = vendedor.name || 'Vendedor';
          const leadNome = lead.companyName || lead.name || lead.email;
          this.notificationsService.create({
            userId: vendedor.gestorId,
            type: NotificationType.NEW_LEAD,
            title: 'Novo lead na equipe',
            message: `${leadNome} foi criado por ${vendedorNome}.`,
            link: '/leads',
            metadata: { leadId: lead.id, vendedorId: lead.vendedorId },
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    return lead;
  }

  /**
   * Atualizar lead (com validação de acesso)
   */
  async update(id: string, dto: UpdateLeadDto, currentUserId: string, currentUserRole: UserRole) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${id} não encontrado`);
    }

    // Validar acesso
    if (lead.vendedorId) {
      await this.validateAccess(lead.vendedorId, currentUserId, currentUserRole);
    }

    // ========== INÍCIO: CONVERTER STATUS LEGADO → STAGEID ==========
    // Frontend envia status antigos (EM_CONTATO, QUALIFICADO, etc)
    // Backend converte para stageId + mantém status=ABERTO
    if (dto.status && dto.status !== 'GANHO' && dto.status !== 'PERDIDO' && dto.status !== 'ABERTO') {
      // Mapeia status legado → nome do estágio no banco
      // Nomes do banco foram atualizados para corresponder ao frontend
      const statusToStageMap: Record<string, string> = {
        'ABERTO': 'Novo',
        'TENTATIVA_CONTATO': 'Tentativa de contato',
        'EM_CONTATO': 'Contato Feito',
        'DEMONSTRACAO': 'Demonstração agendada',
        'QUALIFICADO': 'Qualificado',
        'PROPOSTA': 'Proposta Enviada',
        'NEGOCIACAO': 'Negociação',
      };

      const stageName = statusToStageMap[dto.status];

      if (stageName) {
        // Buscar estágio no banco pelo nome
        const funnelStage = await this.prisma.funnelStage.findFirst({
          where: { name: { equals: stageName, mode: 'insensitive' } },
        });

        if (!funnelStage) {
          this.logger.warn(`⚠️ Estágio "${stageName}" não encontrado no FunnelStage`);
          // Remove status inválido do DTO para evitar erro 500
          delete (dto as any).status;
        } else {
          // Adiciona stageId mas MANTÉM o status original (frontend usa status para determinar coluna)
          (dto as any).stageId = funnelStage.id;

          this.logger.log(`✅ Mapeado: status="${dto.status}" → stageId="${funnelStage.id}" (${funnelStage.name})`);
        }
      } else {
        // Status desconhecido, remove do DTO
        this.logger.warn(`⚠️ Status desconhecido: "${dto.status}" - removendo do DTO`);
        delete (dto as any).status;
      }
    }
    // ========== FIM: CONVERTER STATUS LEGADO → STAGEID ==========

    // VENDEDOR não pode alterar vendedorId
    if (dto.vendedorId && currentUserRole === UserRole.VENDEDOR) {
      throw new ForbiddenException('Você não pode reatribuir seus próprios leads');
    }

    // GESTOR pode reatribuir apenas dentro da sua equipe
    if (dto.vendedorId && currentUserRole === UserRole.GESTOR) {
      const vendedor = await this.prisma.user.findUnique({
        where: { id: dto.vendedorId },
      });

      if (!vendedor) {
        throw new NotFoundException(`Vendedor ${dto.vendedorId} não encontrado`);
      }

      if (vendedor.gestorId !== currentUserId && dto.vendedorId !== currentUserId) {
        throw new ForbiddenException('Você só pode reatribuir leads dentro da sua equipe');
      }
    }

    // Validar novo vendedor se fornecido
    if (dto.vendedorId) {
      const vendedor = await this.prisma.user.findUnique({
        where: { id: dto.vendedorId },
      });

      if (!vendedor || !vendedor.isActive) {
        throw new BadRequestException('Vendedor inválido ou inativo');
      }
    }

    // Validar plano se fornecido
    if (dto.interestPlanId !== undefined) {
      if (dto.interestPlanId) {
        const plan = await this.prisma.plan.findUnique({
          where: { id: dto.interestPlanId },
        });

        if (!plan) {
          throw new NotFoundException(`Plano ${dto.interestPlanId} não encontrado`);
        }

        // Se está mudando o tipo de produto, validar plano
        const productType = dto.interestProduct || lead.interestProduct;
        if (plan.product !== productType) {
          throw new BadRequestException(
            `Plano ${plan.name} é para ${plan.product}, mas lead é para ${productType}`,
          );
        }
      }
    }

    // Remove fields that don't exist in Prisma schema (same as create method)
    const { origin, ...updateData } = dto as any;

    // Se status mudou para GANHO ou PERDIDO, atualizar stageId para o estágio correto
    const dataToUpdate: any = { ...updateData };
    if (dto.status === LeadStatus.GANHO || dto.status === LeadStatus.PERDIDO) {
      // Buscar estágio final correspondente
      const finalStage = await this.prisma.funnelStage.findFirst({
        where: { name: dto.status === LeadStatus.GANHO ? 'Ganho' : 'Perdido' },
      });

      if (finalStage) {
        dataToUpdate.stageId = finalStage.id;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SINCRONIZAÇÃO INVERSA: Se stageId mudou (drag-and-drop), sincronizar status
    // ═══════════════════════════════════════════════════════════════════════════
    if (dto.stageId && dto.stageId !== lead.stageId) {
      const stage = await this.prisma.funnelStage.findUnique({
        where: { id: dto.stageId },
      });

      if (stage) {
        // Mapear stage.name para status correspondente
        if (stage.name === 'Ganho') {
          dataToUpdate.status = LeadStatus.GANHO;
          this.logger.log(`✅ Lead ${id}: stageId → Ganho, status atualizado para GANHO`);
        } else if (stage.name === 'Perdido') {
          dataToUpdate.status = LeadStatus.PERDIDO;
          this.logger.log(`✅ Lead ${id}: stageId → Perdido, status atualizado para PERDIDO`);
        } else {
          dataToUpdate.status = LeadStatus.ABERTO;
          this.logger.log(`✅ Lead ${id}: stageId → ${stage.name}, status atualizado para ABERTO`);
        }
      } else {
        this.logger.warn(`⚠️ Lead ${id}: stageId "${dto.stageId}" não encontrado no banco`);
      }
    }

    // Se status mudou para GANHO, tentar conversão automática para Cliente
    if (dto.status === LeadStatus.GANHO && lead.status !== LeadStatus.GANHO) {
      dataToUpdate.convertedAt = new Date();

      // Verificar se lead tem dados completos para conversão automática
      const hasRequiredData =
        lead.cpfCnpj &&
        lead.interestPlanId &&
        lead.vendedorId &&
        (lead.companyName || lead.name);

      if (hasRequiredData) {
        // Conversão automática: criar cliente baseado no interestProduct
        try {
          // Verificar se já existe cliente com este CPF/CNPJ (ignora CANCELADOS)
          const existingClient = await this.prisma.client.findFirst({
            where: { cpfCnpj: lead.cpfCnpj!, status: { not: 'CANCELADO' as any } },
          });

          if (!existingClient) {
            // Validar plano
            const plan = await this.prisma.plan.findUnique({
              where: { id: lead.interestPlanId! },
            });

            if (!plan) {
              this.logger.warn(
                `⚠️ Conversão automática falhou: Plano ${lead.interestPlanId} não encontrado`,
              );
            } else {
              // Criar cliente em transação baseado no produto do plano
              await this.prisma.$transaction(async (tx) => {
                // Atualizar lead
                const updatedLead = await tx.lead.update({
                  where: { id },
                  data: dataToUpdate,
                  include: {
                    vendedor: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                });

                // Criar cliente automaticamente com o produto do plano contratado
                await tx.client.create({
                  data: {
                    company: lead.companyName || lead.name,
                    contactName: lead.name,
                    email: lead.email,
                    phone: lead.phone,
                    cpfCnpj: lead.cpfCnpj!,
                    productType: plan.product,
                    planId: lead.interestPlanId!,
                    vendedorId: lead.vendedorId!,
                    status: ClientStatus.EM_TRIAL,
                    leadId: lead.id,
                    notes: lead.notes,
                  },
                });

                const moduleName = plan.product === 'ONE_NEXUS'
                  ? 'Clientes One Nexus'
                  : 'Clientes NexLoc';

                this.logger.log(
                  `✅ Lead convertido automaticamente: ${lead.companyName || lead.name} → Cliente ${plan.product} (${moduleName})`,
                );

                return { updatedLead, productType: plan.product, moduleName };
              });

              // Retornar lead atualizado com informações de conversão
              const updated = await this.prisma.lead.findUnique({
                where: { id },
                include: {
                  vendedor: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                  interestPlan: {
                    select: {
                      id: true,
                      name: true,
                      product: true,
                    },
                  },
                },
              });

              // Add conversion metadata to response
              return {
                ...updated,
                _conversion: {
                  productType: plan.product,
                  moduleName: plan.product === 'ONE_NEXUS' ? 'Clientes One Nexus' : 'Clientes NexLoc',
                },
              };
            }
          } else {
            this.logger.warn(
              `⚠️ Conversão automática falhou: Cliente com CPF/CNPJ ${lead.cpfCnpj} já existe`,
            );
          }
        } catch (error) {
          this.logger.error(`❌ Erro na conversão automática: ${error.message}`, error.stack);
          // Continuar com atualização simples do lead
        }
      } else {
        this.logger.log(
          `ℹ️ Lead marcado como GANHO mas conversão automática não realizada: dados incompletos (requer cpfCnpj, interestPlanId, vendedorId)`,
        );
      }
    }

    // Atualização padrão se não houve conversão automática
    const updated = await this.prisma.lead.update({
      where: { id },
      data: dataToUpdate,
      include: {
        vendedor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        interestPlan: {
          select: {
            id: true,
            name: true,
            product: true,
          },
        },
      },
    });

    this.logger.log(`✅ Lead atualizado: ${updated.companyName || updated.name} (${updated.email})`);

    // ✅ v2.34.0: Recalcular Lead Score após atualização
    try {
      await this.leadScoreService.updateLeadScore(updated.id);
      this.logger.debug(`📊 Lead Score recalculado para lead ${updated.id}`);
    } catch (error) {
      this.logger.warn(`⚠️ Erro ao recalcular Lead Score: ${error.message}`);
      // Não falhar a atualização do lead se o score falhar
    }

    // ✅ v2.58.0: Notificar novo vendedor quando lead for reatribuído
    if (dto.vendedorId && dto.vendedorId !== lead.vendedorId) {
      this.notificationsService.create({
        userId: dto.vendedorId,
        type: NotificationType.LEAD_ASSIGNED,
        title: 'Lead atribuído a você',
        message: `${updated.companyName || updated.name} foi transferido para você.`,
        link: '/leads',
      }).catch(() => {});
    }

    // Se foi marcado como GANHO, incluir metadata de conversão mesmo sem conversão automática
    if (updated.status === LeadStatus.GANHO && updated.interestPlan) {
      return {
        ...updated,
        _conversion: {
          productType: updated.interestPlan.product,
          moduleName: updated.interestPlan.product === 'ONE_NEXUS' ? 'Clientes One Nexus' : 'Clientes NexLoc',
          planName: updated.interestPlan.name,
        },
      };
    }

    return updated;
  }

  /**
   * Verificar se CNPJ já existe no sistema
   * Retorna informações sobre registro existente (lead ou cliente)
   */
  async checkDuplicateCnpj(cnpj: string) {
    // Limpar CNPJ (remover pontos, barras, hífens)
    const cleanCnpj = cnpj.replace(/[.\-\/\s]/g, '');

    // ✅ v2.33.1: Usar raw SQL para remover caracteres especiais do banco antes de comparar
    // PostgreSQL REGEXP_REPLACE remove todos os caracteres não-numéricos

    // Verificar em clientes primeiro (prioridade mais alta)
    // ✅ v2.63.2: Ignorar clientes CANCELADOS — podem ser recriados com mesmo CNPJ
    const existingClient = await this.prisma.$queryRaw<Array<{
      id: string;
      company: string;
      cpfCnpj: string;
      status: string;
      vendedorName: string | null;
    }>>`
      SELECT
        c.id,
        c.company,
        c."cpfCnpj",
        c.status,
        u.name as "vendedorName"
      FROM "Client" c
      LEFT JOIN "User" u ON c."vendedorId" = u.id
      WHERE REGEXP_REPLACE(c."cpfCnpj", '[^0-9]', '', 'g') = ${cleanCnpj}
        AND c.status != 'CANCELADO'
      LIMIT 1
    `;

    if (existingClient.length > 0) {
      const client = existingClient[0];
      return {
        exists: true,
        type: 'CLIENT' as const,
        status: client.status,
        record: {
          id: client.id,
          name: client.company,
          cnpj: client.cpfCnpj,
          assignedTo: client.vendedorName || 'N/A',
        },
        message: `CNPJ já cadastrado como cliente ${client.status === 'ATIVO' ? 'ativo' : 'inativo'}`,
      };
    }

    // Verificar em leads
    // ✅ v2.63.2: Ignorar leads CONVERTIDO/GANHO/PERDIDO — já finalizados, não bloqueiam novo cadastro
    const existingLead = await this.prisma.$queryRaw<Array<{
      id: string;
      companyName: string;
      name: string;
      cpfCnpj: string;
      status: string;
      vendedorName: string | null;
    }>>`
      SELECT
        l.id,
        l."companyName",
        l.name,
        l."cpfCnpj",
        l.status,
        u.name as "vendedorName"
      FROM "Lead" l
      LEFT JOIN "User" u ON l."vendedorId" = u.id
      WHERE REGEXP_REPLACE(l."cpfCnpj", '[^0-9]', '', 'g') = ${cleanCnpj}
        AND l.status NOT IN ('CONVERTIDO', 'GANHO', 'PERDIDO')
      LIMIT 1
    `;

    if (existingLead.length > 0) {
      const lead = existingLead[0];
      return {
        exists: true,
        type: 'LEAD' as const,
        status: lead.status,
        record: {
          id: lead.id,
          name: lead.companyName || lead.name,
          cnpj: lead.cpfCnpj || '',
          assignedTo: lead.vendedorName || 'N/A',
        },
        message: 'CNPJ já cadastrado como lead no sistema',
      };
    }

    return {
      exists: false,
      message: 'CNPJ disponível',
    };
  }

  /**
   * Deletar lead (apenas SUPERADMIN/ADMINISTRATIVO)
   */
  async remove(id: string, currentUserId: string, currentUserRole: UserRole) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${id} não encontrado`);
    }

    // Apenas SUPERADMIN e ADMINISTRATIVO podem deletar
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.ADMINISTRATIVO
    ) {
      throw new ForbiddenException('Apenas administradores podem deletar leads');
    }

    await this.prisma.lead.delete({
      where: { id },
    });

    this.logger.warn(`⚠️ Lead deletado: ${lead.companyName || lead.name} (${lead.email})`);
  }

  /**
   * Converter lead em cliente
   * (Este método será chamado pelo ClientsService)
   */
  async markAsConverted(id: string) {
    return this.prisma.lead.update({
      where: { id },
      data: {
        status: LeadStatus.GANHO,
        convertedAt: new Date(),
      },
    });
  }

  /**
   * Helper: Validar acesso a um lead
   */
  private async validateAccess(
    leadVendedorId: string,
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

    // GESTOR pode acessar leads da sua equipe
    if (currentUserRole === UserRole.GESTOR) {
      // Buscar vendedor do lead
      const vendedor = await this.prisma.user.findUnique({
        where: { id: leadVendedorId },
      });

      if (vendedor && (vendedor.gestorId === currentUserId || leadVendedorId === currentUserId)) {
        return;
      }
    }

    // VENDEDOR pode acessar apenas seus próprios leads
    if (leadVendedorId === currentUserId) {
      return;
    }

    throw new ForbiddenException('Você não tem permissão para acessar este lead');
  }

  /**
   * Buscar cidades na API IBGE
   */
  async searchCities(query: string): Promise<Array<{ name: string; id: number }>> {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome`,
        {
          signal: AbortSignal.timeout(5000), // 5 second timeout
        }
      );

      if (!response.ok) {
        this.logger.error(`IBGE API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const cities: Array<{
        id: number;
        nome: string;
        microrregiao: {
          mesorregiao: {
            UF: {
              sigla: string;
            };
          };
        };
      }> = await response.json();

      // Filter cities by query (case-insensitive)
      const filtered = cities
        .filter((city) => city.nome.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 20) // Limit to 20 results
        .map((city) => ({
          id: city.id,
          name: `${city.nome} - ${city.microrregiao.mesorregiao.UF.sigla}`,
        }));

      return filtered;
    } catch (error) {
      this.logger.error(`Error fetching cities from IBGE: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Adicionar interação à linha do tempo de um lead
   */
  async addInteraction(
    leadId: string,
    userId: string,
    content: string,
  ) {
    // Verificar se lead existe
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} não encontrado`);
    }

    return this.prisma.interaction.create({
      data: {
        leadId,
        userId,
        type: 'NOTE',
        title: 'Interação',
        content,
      },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Converte um Lead em Cliente com dados estratégicos
   *
   * Fluxo:
   * 1. Valida lead existe e não está convertido
   * 2. Valida plano existe
   * 3. Cria Client com todos os campos novos
   * 4. Atualiza Lead (status = GANHO)
   * 5. Cria FinanceTransaction (PENDING) para primeiro pagamento
   * 6. Retorna client + transaction + metadata
   */
  async convert(
    leadId: string,
    dto: ConvertLeadDto,
    currentUserId: string,
  ): Promise<{
    client: any;
    transaction: any;
    _conversion: { productType: string; moduleName: string };
  }> {
    this.logger.log(`🔄 Iniciando conversão do lead ${leadId}`);

    // 1. Buscar lead com relacionamentos
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        interestPlan: true,
        origin: true,
        stage: true,
        vendedor: true,
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} não encontrado`);
    }

    // ✅ CORREÇÃO v2.27.0: Validação simplificada de reconversão
    // Permite reconversão se:
    // 1. Lead nunca foi convertido (convertedAt === null)
    // 2. OU lead foi marcado como PERDIDO (permite segunda chance, independente do stage atual)
    // Bloqueia apenas se lead está atualmente com status GANHO
    if (lead.status === LeadStatus.GANHO) {
      throw new BadRequestException('Lead está GANHO. Marque como PERDIDO para reconverter.');
    }

    // 2. Buscar plano selecionado (pode ser diferente do interesse original)
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException(`Plano ${dto.planId} não encontrado`);
    }

    // 3. Buscar estágio "Ganho"
    const ganhoStage = await this.prisma.funnelStage.findFirst({
      where: {
        OR: [
          { name: { contains: 'Ganho', mode: 'insensitive' } },
          { name: { contains: 'Won', mode: 'insensitive' } },
          { name: { contains: 'Convertido', mode: 'insensitive' } },
        ],
      },
    });

    // 4. ✅ CORREÇÃO v2.28.0: Verificar se CPF/CNPJ já existe (ignora CANCELADOS)
    if (lead.cpfCnpj && lead.cpfCnpj !== 'PENDING') {
      const existingClient = await this.prisma.client.findFirst({
        where: { cpfCnpj: lead.cpfCnpj, status: { not: 'CANCELADO' as any } },
      });

      if (existingClient) {
        throw new BadRequestException(
          `Já existe um cliente com o CPF/CNPJ ${lead.cpfCnpj}. ` +
          `Cliente: ${existingClient.company} (ID: ${existingClient.id}). ` +
          `Não é possível converter este lead.`,
        );
      }
    }

    // 5. Executar transação atômica
    const result = await this.prisma.$transaction(async (tx) => {
      // 5.1 Criar Client
      const client = await tx.client.create({
        data: {
          // Dados básicos do lead
          contactName: lead.name,
          company: lead.companyName || lead.name,
          email: lead.email,
          phone: lead.phone,
          cpfCnpj: lead.cpfCnpj || 'PENDING',
          role: lead.role,

          // Plano e produto
          planId: dto.planId,
          productType: plan.product, // ONE_NEXUS ou LOCADORAS

          // Vendedor responsável
          vendedorId: lead.vendedorId || currentUserId,

          // === NOVOS CAMPOS DA CONVERSÃO ===
          billingCycle: dto.billingCycle,
          dealSummary: dto.dealSummary,
          numberOfUsers: dto.numberOfUsers,
          closedAt: this.parseSafeDateOrNow(dto.closedAt, 'closedAt'),
          firstPaymentDate: this.parseSafeDateOrNow(dto.firstPaymentDate, 'firstPaymentDate'),
          implementationNotes: dto.implementationNotes || null,

          // Rastreabilidade
          convertedFromLeadId: lead.id,

          // Status inicial (✅ v2.43.0: EM_TRIAL até confirmar 1º pagamento)
          status: ClientStatus.EM_TRIAL,
        },
        include: {
          plan: true,
          vendedor: true,
        },
      });

      this.logger.log(`✅ Cliente criado: ${client.id} - ${client.company}`);

      // 4.2 Atualizar Lead (atualiza interestPlanId com plano fechado)
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.GANHO,
          stageId: ganhoStage?.id || lead.stageId,
          convertedAt: parseDateBrasilia(new Date().toISOString().split('T')[0]),
          interestPlanId: dto.planId, // Atualiza plano de interesse com plano fechado
        },
      });

      this.logger.log(`✅ Lead atualizado para GANHO`);

      // 4.x Limpar interações do lead (não são mais necessárias após conversão)
      await tx.interaction.deleteMany({ where: { leadId } });

      // 4.3 ✅ v2.40.0: Criar Subscription + primeiro Payment via SubscriptionService
      // Isso substitui a lógica manual de criação de payments
      // O SubscriptionService usa parseDateBrasilia() internamente (corrige bug off-by-1-day)
      // ✅ v2.41.1: Aplica 10% desconto FIXO em planos anuais (amount = MRR mensal)
      const monthlyAmount = Number(plan.priceMonthly);
      const subscriptionAmount = dto.billingCycle === 'ANNUAL'
        ? monthlyAmount * 0.9  // 10% desconto no valor mensal
        : monthlyAmount;        // sem desconto

      // ✅ v2.46.0: Prioriza billingAnchorDay do frontend, fallback para firstPaymentDate
      const anchorDay = dto.billingAnchorDay
        ?? (dto.firstPaymentDate ? new Date(dto.firstPaymentDate).getDate() : new Date().getDate());
      const safeBillingAnchorDay = Math.min(Math.max(anchorDay, 1), 28);

      // Construir firstPaymentDate usando billingAnchorDay
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const firstPaymentDateStr = `${year}-${String(month).padStart(2, '0')}-${String(safeBillingAnchorDay).padStart(2, '0')}`;

      const subscription = await this.subscriptionService.createFromConversion(
        {
          clientId: client.id,
          planId: dto.planId,
          billingCycle: dto.billingCycle,
          firstPaymentDate: firstPaymentDateStr,
          amount: subscriptionAmount,
        },
        tx, // ✅ v2.40.3: Pass transaction context
      );

      // Buscar o primeiro payment criado pela subscription
      const firstPayment = await tx.payment.findFirst({
        where: {
          clientId: client.id,
          subscriptionId: subscription.id,
        },
        orderBy: { createdAt: 'asc' },
      });

      this.logger.log(`✅ Subscription criada: ${subscription.id} com primeiro payment`);

      // ═══════════════════════════════════════════════════════════════════
      // v2.43.0: CRIAR FINANCE TRANSACTION AUTOMATICAMENTE
      // Integra o cliente no módulo financeiro para MRR tracking
      // ═══════════════════════════════════════════════════════════════════

      // Calcular MRR baseado no billing cycle (mesma lógica do frontend)
      const calculatedMRR =
        dto.billingCycle === 'ANNUAL'
          ? Number(plan.priceMonthly) * 0.9 // 10% desconto para anual
          : Number(plan.priceMonthly);

      // ✅ v2.46.0: Usar nextBillingDate da Subscription (já calculado com billingAnchorDay correto)
      const nextDueDate = subscription.nextBillingDate || subscription.currentPeriodEnd;

      // Criar transação financeira vinculada ao cliente
      const financeTransaction = await tx.financeTransaction.create({
        data: {
          description: `Assinatura ${plan.name} - ${client.company}`,
          amount: calculatedMRR,
          type: 'INCOME',
          category: 'SUBSCRIPTION',
          date: new Date(),
          dueDate: nextDueDate, // Próximo vencimento
          status: 'PENDING',
          clientId: client.id,
          subscriptionId: subscription.id, // ✅ v2.47.0: Vincular à subscription
          productType: client.productType,
          isRecurring: true,
          createdBy: currentUserId,
        },
      });

      this.logger.log(
        `✅ FinanceTransaction criada: ${financeTransaction.id} | ` +
          `Cliente: ${client.company} | MRR: R$ ${calculatedMRR} | ` +
          `Vencimento: ${nextDueDate.toISOString().split('T')[0]}`,
      );

      // ═══════════════════════════════════════════════════════════════════

      return { client, transaction: firstPayment, subscription };
    });

    // 5. Provisionar no One Nexus (apenas ONE_NEXUS, fora da tx para não bloquear rollback)
    if (plan.product === ProductType.ONE_NEXUS) {
      await this.tenantsService.provisionOnOneNexus(result.client.id);
    }

    // 6. Determinar módulo de destino
    const moduleName = plan.product === ProductType.ONE_NEXUS ? 'Clientes One Nexus' : 'Clientes NexLoc';

    this.logger.log(`🎉 Conversão concluída! Cliente agora em: ${moduleName}`);

    // ✅ v2.58.0: Notificar vendedor sobre lead convertido
    if (lead.vendedorId) {
      this.notificationsService.create({
        userId: lead.vendedorId,
        type: NotificationType.LEAD_CONVERTED,
        title: 'Lead convertido em cliente! 🎉',
        message: `${result.client.company} agora é um cliente ativo.`,
        link: '/clients',
        metadata: { clientId: result.client.id },
      }).catch(() => {});
    }

    return {
      client: result.client,
      transaction: result.transaction,
      _conversion: {
        productType: plan.product,
        moduleName,
      },
    };
  }

  /**
   * Helper: Parse date safely or return current date
   * Handles undefined, null, empty strings, and invalid dates
   *
   * @param dateValue - Date string, Date object, or falsy value
   * @param fieldName - Field name for logging
   * @returns Valid Date object (never returns Invalid Date)
   */
  private parseSafeDateOrNow(
    dateValue: string | Date | null | undefined,
    fieldName: string,
  ): Date {
    // Handle null, undefined, or empty string
    if (!dateValue || dateValue === '') {
      this.logger.log(`⚠️ ${fieldName} is empty/null, using current date`);
      return nowBrasilia();
    }

    try {
      // Extract date string
      let dateStr: string;

      if (dateValue instanceof Date) {
        // Already a Date object
        if (isNaN(dateValue.getTime())) {
          this.logger.warn(`⚠️ ${fieldName} is Invalid Date object, using current date`);
          return nowBrasilia();
        }
        dateStr = dateValue.toISOString().split('T')[0];
      } else if (typeof dateValue === 'string') {
        // String value
        if (dateValue.trim() === '') {
          this.logger.log(`⚠️ ${fieldName} is empty string, using current date`);
          return nowBrasilia();
        }

        // Try to extract YYYY-MM-DD from ISO string or use as-is
        if (dateValue.includes('T')) {
          dateStr = dateValue.split('T')[0];
        } else {
          dateStr = dateValue;
        }
      } else {
        // Unexpected type
        this.logger.warn(`⚠️ ${fieldName} has unexpected type: ${typeof dateValue}, using current date`);
        return nowBrasilia();
      }

      // Validate dateStr format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        this.logger.warn(`⚠️ ${fieldName} has invalid format: ${dateStr}, using current date`);
        return nowBrasilia();
      }

      // Parse with timezone handling
      const parsed = parseDateBrasilia(dateStr);

      // Final validation
      if (isNaN(parsed.getTime())) {
        this.logger.warn(`⚠️ ${fieldName} failed to parse: ${dateStr}, using current date`);
        return nowBrasilia();
      }

      return parsed;
    } catch (error) {
      this.logger.error(`❌ Error parsing ${fieldName}: ${error.message}, using current date`);
      return nowBrasilia();
    }
  }

  /**
   * Gera resumo da negociação usando IA (ou fallback simples)
   * @param leadId - ID do lead
   * @param customPlanId - Optional: ID do plano customizado selecionado no modal
   */
  async generateSummary(leadId: string, customPlanId?: string): Promise<{ summary: string }> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        interestPlan: true,
        origin: true,
        stage: true,
        vendedor: true,
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} não encontrado`);
    }

    // ✅ Se planId customizado fornecido, buscar plano específico
    let planName = lead.interestPlan?.name || 'a definir';
    if (customPlanId && customPlanId !== lead.interestPlanId) {
      const customPlan = await this.prisma.plan.findUnique({
        where: { id: customPlanId },
      });
      if (customPlan) {
        planName = customPlan.name;
      }
    }

    // Calcular dias no funil
    const daysInFunnel = Math.floor(
      (new Date().getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    // TODO: Integrar com serviço de IA (Groq/Gemini) quando disponível
    // Por enquanto, usar fallback simples

    const fallbackSummary = `
Lead ${lead.companyName || lead.name} demonstrou interesse no plano ${planName}.
Origem: ${lead.origin?.name || 'não informada'}.
Tempo no funil: ${daysInFunnel} dias.
${lead.notes ? `Observações: ${lead.notes.substring(0, 200)}` : 'Sem observações registradas.'}
    `.trim();

    this.logger.log(`📝 Resumo gerado para lead ${leadId} (plano: ${planName})`);

    return { summary: fallbackSummary };
  }

  /**
   * Listar todas as origens de leads ativas
   */
  async getOrigins() {
    return this.prisma.leadOrigin.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}
