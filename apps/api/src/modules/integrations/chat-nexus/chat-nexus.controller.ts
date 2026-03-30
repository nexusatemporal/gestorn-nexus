import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { ChatNexusService } from './chat-nexus.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { UserRole, NotificationType, ProductType, LeadStatus } from '@prisma/client';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface ChatWebhookPayload {
  event: string;
  tenantId?: string;
  timestamp: string;
  data: {
    messageId: string;
    conversationId: string;
    content: string;
    sender: {
      name?: string;
      email?: string;
      phone?: string;
      empresa?: string;
      sistema?: string;
    };
  };
}

/**
 * ChatNexus Controller
 *
 * Endpoints para integração com o Chat Nexus:
 * - POST /chat-nexus/sso-token  — Gera token SSO (autenticado via JWT)
 * - POST /webhooks/nexus-chat   — Recebe webhooks do Chat (público, validação HMAC)
 *
 * v2.65.0
 */
@Controller()
export class ChatNexusController {
  private readonly logger = new Logger(ChatNexusController.name);

  constructor(
    private readonly chatNexusService: ChatNexusService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * POST /chat-nexus/sso-token
   *
   * Gera token SSO temporário para autenticar o usuário logado no Chat Nexus.
   * O frontend usa esse token para montar a URL do iframe.
   */
  @Post('chat-nexus/sso-token')
  async generateSsoToken(@CurrentUser() user: AuthUser) {
    const result = await this.chatNexusService.generateSsoToken(user.email, {
      name: user.name,
      role: user.role,
      userId: user.id,
    });

    if (!result) {
      throw new InternalServerErrorException(
        'Falha ao gerar token SSO para o Chat Nexus',
      );
    }

    return result;
  }

  /**
   * POST /webhooks/nexus-chat
   *
   * Recebe webhooks do Chat Nexus (novo mensagem, conversa iniciada, etc).
   * Público (sem JWT), validação via HMAC SHA256.
   *
   * Eventos tratados:
   * - NEW_MESSAGE: Cria lead no Kanban (ou adiciona nota se lead já existe)
   * - CONVERSATION_STARTED: Log de atividade
   */
  @Public()
  @Post('webhooks/nexus-chat')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: ChatWebhookPayload,
    @Headers('x-webhook-signature') signature?: string,
  ) {
    // Validar assinatura HMAC
    if (!signature) {
      throw new UnauthorizedException('Header X-Webhook-Signature ausente');
    }

    const rawBody = JSON.stringify(payload);
    const isValid = this.chatNexusService.validateWebhookSignature(
      rawBody,
      signature,
    );

    if (!isValid) {
      throw new UnauthorizedException('Assinatura HMAC inválida');
    }

    const { event, data } = payload;

    this.logger.log(
      `[ChatNexus] Webhook recebido: ${event} | conversationId: ${data?.conversationId}`,
    );

    switch (event) {
      case 'MESSAGE_RECEIVED':
        await this.handleNewMessage(data);
        break;

      case 'CONVERSATION_STARTED':
        this.logger.log(
          `[ChatNexus] Conversa iniciada: ${data.conversationId} | sender: ${data.sender?.email || 'anônimo'}`,
        );
        break;

      case 'CONVERSATION_ASSIGNED':
        this.logger.log(
          `[ChatNexus] Conversa atribuída: ${data.conversationId}`,
        );
        break;

      case 'CONVERSATION_RESOLVED':
        this.logger.log(
          `[ChatNexus] Conversa resolvida: ${data.conversationId}`,
        );
        break;

      default:
        this.logger.debug(`[ChatNexus] Evento não tratado: ${event}`);
    }

    return { success: true };
  }

  /**
   * Processa evento NEW_MESSAGE:
   * 1. Se lead com mesmo email já existe → adiciona nota
   * 2. Se não existe → cria lead com dados parciais no stage "Aberto"
   *
   * Usa conversationId como chave de idempotência.
   */
  private async handleNewMessage(data: ChatWebhookPayload['data']) {
    const senderEmail = data.sender?.email;

    if (!senderEmail) {
      this.logger.warn(
        '[ChatNexus] NEW_MESSAGE sem email do sender — ignorando',
      );
      return;
    }

    try {
      // Verificar se já existe lead com esse email
      const existingLead = await this.prisma.lead.findFirst({
        where: {
          email: senderEmail.toLowerCase(),
          status: LeadStatus.ABERTO,
        },
      });

      if (existingLead) {
        // Lead já existe → adicionar nota com a mensagem
        const currentNotes = existingLead.notes || '';
        const timestamp = new Date().toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
        });
        const newNote = `\n[Chat ${timestamp}] ${data.content}`;

        await this.prisma.lead.update({
          where: { id: existingLead.id },
          data: { notes: currentNotes + newNote },
        });

        this.logger.log(
          `[ChatNexus] ✅ Nota adicionada ao lead existente: ${existingLead.id} (${senderEmail})`,
        );
        return;
      }

      // Lead não existe → criar novo lead com dados parciais

      // Buscar origin "Chat Nexus"
      let chatOrigin = await this.prisma.leadOrigin.findFirst({
        where: { name: { contains: 'Chat Nexus', mode: 'insensitive' } },
      });

      // Se não existe, criar
      if (!chatOrigin) {
        chatOrigin = await this.prisma.leadOrigin.create({
          data: { name: 'Chat Nexus', isActive: true },
        });
        this.logger.log('[ChatNexus] LeadOrigin "Chat Nexus" criado');
      }

      // Buscar default stage
      const defaultStage = await this.prisma.funnelStage.findFirst({
        where: { isDefault: true },
      });

      if (!defaultStage) {
        this.logger.error('[ChatNexus] ❌ Nenhum estágio padrão encontrado');
        return;
      }

      // Round-robin: buscar vendedores ativos e atribuir ao próximo
      const vendedorId = await this.getNextVendedor();

      if (!vendedorId) {
        this.logger.error(
          '[ChatNexus] ❌ Nenhum vendedor ativo encontrado para atribuição',
        );
        return;
      }

      // Criar lead via Prisma (bypass DTO — webhook traz dados parciais)
      const lead = await this.prisma.lead.create({
        data: {
          name: data.sender?.name || 'Contato via Chat',
          email: senderEmail.toLowerCase(),
          phone: data.sender?.phone || '',
          companyName: data.sender?.empresa || 'Empresa não informada',
          city: 'Não informado',
          interestProduct: ProductType.ONE_NEXUS,
          status: LeadStatus.ABERTO,
          role: 'OUTRO',
          stageId: defaultStage.id,
          originId: chatOrigin.id,
          vendedorId,
          notes: `Mensagem inicial via Chat Nexus:\n"${data.content}"\n\nConversation ID: ${data.conversationId}`,
        },
      });

      this.logger.log(
        `[ChatNexus] ✅ Lead criado: ${lead.id} (${senderEmail}) → vendedor: ${vendedorId}`,
      );

      // Notificar vendedor
      this.notificationsService
        .create({
          userId: vendedorId,
          type: NotificationType.LEAD_ASSIGNED,
          title: 'Novo lead via Chat',
          message: `${data.sender?.name || senderEmail} enviou mensagem pelo Chat Nexus.`,
          link: '/leads',
          metadata: { leadId: lead.id, source: 'chat_nexus' },
        })
        .catch(() => {});
    } catch (error) {
      this.logger.error(
        `[ChatNexus] ❌ Erro ao processar NEW_MESSAGE: ${error?.message}`,
      );
    }
  }

  /**
   * Round-robin simples para distribuir leads entre vendedores ativos.
   * Busca o vendedor com MENOS leads abertos.
   */
  private async getNextVendedor(): Promise<string | null> {
    // Buscar vendedores ativos (VENDEDOR ou GESTOR)
    const vendedores = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [UserRole.VENDEDOR, UserRole.GESTOR] },
      },
      select: {
        id: true,
        _count: {
          select: {
            assignedLeads: {
              where: { status: LeadStatus.ABERTO },
            },
          },
        },
      },
      orderBy: {
        assignedLeads: { _count: 'asc' },
      },
      take: 1,
    });

    if (vendedores.length === 0) {
      // Fallback: buscar qualquer SUPERADMIN ativo
      const admin = await this.prisma.user.findFirst({
        where: { isActive: true, role: UserRole.SUPERADMIN },
        select: { id: true },
      });
      return admin?.id || null;
    }

    return vendedores[0].id;
  }
}
