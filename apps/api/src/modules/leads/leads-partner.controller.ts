import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { PartnerApiGuard } from '@/common/guards/partner-api.guard';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Partner API — Endpoints para integracoes externas (Nexus Chat).
 * Auth: X-Client-Id + X-Client-Secret (sem JWT).
 * Prefix: /partner/leads
 */
@Public()
@UseGuards(PartnerApiGuard)
@Controller('partner/leads')
export class LeadsPartnerController {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 1. Pipeline Stages ─────────────────────────────────────────────

  @Get('pipeline-stages')
  async getPipelineStages() {
    const stages = await this.prisma.funnelStage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, order: true, color: true },
    });
    return { data: stages };
  }

  // ─── 2. Search lead by chatContactId ────────────────────────────────

  @Get()
  async findLeads(@Query('search') search?: string) {
    // search=chat:{contactId}
    if (search && search.startsWith('chat:')) {
      const contactId = search.replace('chat:', '');
      const leads = await this.prisma.lead.findMany({
        where: { chatContactId: contactId },
        include: {
          stage: { select: { id: true, name: true, color: true } },
          vendedor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return { data: leads.map(this.formatLead) };
    }

    // General list (limited)
    const leads = await this.prisma.lead.findMany({
      take: 50,
      include: {
        stage: { select: { id: true, name: true, color: true } },
        vendedor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: leads.map(this.formatLead) };
  }

  // ─── 3. Lead details ───────────────────────────────────────────────

  @Get(':leadId')
  async findOne(@Param('leadId') leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        stage: { select: { id: true, name: true, color: true } },
        vendedor: { select: { id: true, name: true, email: true } },
        origin: { select: { id: true, name: true } },
        interestPlan: { select: { id: true, name: true } },
      },
    });

    if (!lead) throw new NotFoundException('Lead not found');
    return { data: this.formatLead(lead) };
  }

  // ─── 4. Update lead stage ──────────────────────────────────────────

  @Patch(':leadId/status')
  async updateStage(
    @Param('leadId') leadId: string,
    @Body() body: { stage: string },
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: { stageId: body.stage },
      include: {
        stage: { select: { id: true, name: true, color: true } },
      },
    });

    return { data: this.formatLead(updated) };
  }

  // ─── 5. Register contact type ────────────────────────────────────

  @Patch(':leadId/contact')
  async registerContact(
    @Param('leadId') leadId: string,
    @Body() body: { type: string },
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const systemUser = await this.prisma.user.findFirst({
      where: { isActive: true, role: 'SUPERADMIN' },
    });

    await this.prisma.interaction.create({
      data: {
        leadId,
        userId: systemUser?.id || lead.vendedorId || '',
        type: 'NOTE',
        title: `Contato via ${body.type}`,
        content: `Tipo de contato registrado: ${body.type}`,
      },
    });

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { lastInteractionAt: new Date() },
    });

    return { success: true };
  }

  // ─── 6. Lead timeline ─────────────────────────────────────────────

  @Get(':leadId/timeline')
  async getTimeline(@Param('leadId') leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const interactions = await this.prisma.interaction.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    });

    const data = interactions.map((i) => ({
      id: i.id,
      type: i.type.toLowerCase(),
      description: i.content,
      title: i.title,
      author: i.user?.name || null,
      createdAt: i.createdAt.toISOString(),
    }));

    return { data };
  }

  // ─── 6. Create lead ───────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createLead(
    @Body()
    body: {
      name: string;
      email?: string;
      phone?: string;
      source?: string;
      chatContactId?: string;
      companyName?: string;
    },
  ) {
    // Default stage
    let defaultStage = await this.prisma.funnelStage.findFirst({
      where: { isDefault: true },
    });
    if (!defaultStage) {
      defaultStage = await this.prisma.funnelStage.findFirst({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });
      if (!defaultStage) throw new NotFoundException('No pipeline stages found');
    }

    // Origin "Chat Nexus"
    let chatOrigin = await this.prisma.leadOrigin.findFirst({
      where: { name: { contains: 'Chat', mode: 'insensitive' } },
    });
    if (!chatOrigin) {
      chatOrigin = await this.prisma.leadOrigin.create({
        data: { name: 'Chat Nexus', isActive: true },
      });
    }

    // Round-robin vendedor
    const vendedor = await this.prisma.user.findFirst({
      where: { isActive: true, role: { in: ['VENDEDOR', 'GESTOR'] } },
      orderBy: { assignedLeads: { _count: 'asc' } },
    });

    const lead = await this.prisma.lead.create({
      data: {
        name: body.name,
        email: body.email || '',
        phone: body.phone || '',
        companyName: body.companyName || null,
        chatContactId: body.chatContactId || null,
        stageId: defaultStage.id,
        originId: chatOrigin.id,
        vendedorId: vendedor?.id || null,
        interestProduct: 'ONE_NEXUS',
        status: 'ABERTO',
      },
      include: {
        stage: { select: { id: true, name: true, color: true } },
      },
    });

    return { data: this.formatLead(lead) };
  }

  // ─── 7. Update lead ───────────────────────────────────────────────

  @Put(':leadId')
  async updateLead(
    @Param('leadId') leadId: string,
    @Body() body: Record<string, any>,
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    // Only allow safe fields
    const allowed = [
      'name', 'email', 'phone', 'companyName', 'chatContactId',
      'notes', 'expectedRevenue', 'stageId',
    ];
    const data: Record<string, any> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data,
      include: {
        stage: { select: { id: true, name: true, color: true } },
      },
    });

    return { data: this.formatLead(updated) };
  }

  // ─── 8. Register activity ─────────────────────────────────────────

  @Post(':leadId/activities')
  @HttpCode(HttpStatus.CREATED)
  async addActivity(
    @Param('leadId') leadId: string,
    @Body() body: { type?: string; description: string; metadata?: any },
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    // Get first admin user for userId (required field)
    const systemUser = await this.prisma.user.findFirst({
      where: { isActive: true, role: 'SUPERADMIN' },
    });

    await this.prisma.interaction.create({
      data: {
        leadId,
        userId: systemUser?.id || lead.vendedorId || '',
        type: 'NOTE',
        title: body.type || 'chat_activity',
        content: body.description,
      },
    });

    // Update lastInteractionAt
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { lastInteractionAt: new Date() },
    });

    return { success: true };
  }

  // ─── 9. Add observation ───────────────────────────────────────────

  @Post(':leadId/observations')
  @HttpCode(HttpStatus.CREATED)
  async addObservation(
    @Param('leadId') leadId: string,
    @Body() body: { content: string; author?: string },
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const systemUser = await this.prisma.user.findFirst({
      where: { isActive: true, role: 'SUPERADMIN' },
    });

    await this.prisma.interaction.create({
      data: {
        leadId,
        userId: systemUser?.id || lead.vendedorId || '',
        type: 'NOTE',
        title: `Observacao${body.author ? ` - ${body.author}` : ''}`,
        content: body.content,
      },
    });

    return { success: true };
  }

  // ─── Helper ───────────────────────────────────────────────────────

  private formatLead(lead: any) {
    return {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      companyName: lead.companyName,
      chatContactId: lead.chatContactId,
      stage: lead.stage || null,
      value: lead.expectedRevenue ? Number(lead.expectedRevenue) : null,
      score: lead.score,
      status: lead.status,
      notes: lead.notes,
      vendedor: lead.vendedor || null,
      origin: lead.origin || null,
      interestPlan: lead.interestPlan || null,
      createdAt: lead.createdAt?.toISOString?.() || lead.createdAt,
      updatedAt: lead.updatedAt?.toISOString?.() || lead.updatedAt,
    };
  }
}
