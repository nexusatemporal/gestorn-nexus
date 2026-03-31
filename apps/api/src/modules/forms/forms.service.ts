import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { UserRole, ProductType, VendorAssignmentMode, ClientRole } from '@prisma/client';
import { CreateFormDto, UpdateFormDto, FormFieldDef } from './dto/create-form.dto';
import { randomBytes } from 'crypto';

/**
 * Forms Service — v2.64.0
 *
 * Gerencia formulários de captura de leads para campanhas e landing pages.
 * Submissões públicas criam leads automaticamente no Kanban.
 */
@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
  ) {}

  // ════════════════════════════════════════════════════════════════
  // CRUD (autenticado)
  // ════════════════════════════════════════════════════════════════

  async findAll(currentUserId: string, currentUserRole: UserRole) {
    const isSuperAdmin = (currentUserRole as string) === UserRole.SUPERADMIN || (currentUserRole as string) === UserRole.ADMINISTRATIVO;

    const forms = await this.prisma.form.findMany({
      where: {
        deletedAt: null,
        ...(isSuperAdmin ? {} : { createdById: currentUserId }),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        origin: { select: { id: true, name: true } },
        defaultVendedor: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return forms;
  }

  async findOne(id: string, currentUserId: string, currentUserRole: UserRole) {
    const form = await this.prisma.form.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        origin: { select: { id: true, name: true } },
        defaultVendedor: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
    });

    if (!form || form.deletedAt) {
      throw new NotFoundException('Formulário não encontrado');
    }

    const isSuperAdmin = (currentUserRole as string) === UserRole.SUPERADMIN || (currentUserRole as string) === UserRole.ADMINISTRATIVO;
    if (!isSuperAdmin && form.createdById !== currentUserId) {
      throw new ForbiddenException('Você não tem permissão para acessar este formulário');
    }

    return form;
  }

  async create(dto: CreateFormDto, currentUserId: string) {
    const slug = await this.generateUniqueSlug(dto.slug || dto.name);

    // Se originId não fornecido, criar/buscar origem automática "Formulário Web"
    let originId = dto.originId;
    if (!originId) {
      const autoOrigin = await this.prisma.leadOrigin.upsert({
        where: { name: 'Formulário Web' },
        update: {},
        create: { name: 'Formulário Web', description: 'Leads capturados via formulários do sistema' },
      });
      originId = autoOrigin.id;
    }

    const form = await this.prisma.form.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description ?? null,
        purpose: dto.purpose,
        productType: dto.productType ?? null,
        fields: dto.fields as any,
        successMessage: dto.successMessage ?? 'Obrigado! Entraremos em contato em breve.',
        vendorAssignmentMode: dto.vendorAssignmentMode ?? VendorAssignmentMode.CREATOR,
        defaultVendedorId: dto.defaultVendedorId ?? null,
        roundRobinVendedorIds: dto.roundRobinVendedorIds as any,
        originId,
        isActive: dto.isActive ?? true,
        createdById: currentUserId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        origin: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
    });

    this.logger.log(`✅ Form criado: "${form.name}" (slug: ${form.slug}) por ${currentUserId}`);
    return form;
  }

  async update(id: string, dto: UpdateFormDto, currentUserId: string, currentUserRole: UserRole) {
    const form = await this.findOne(id, currentUserId, currentUserRole);

    const updateData: any = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
      if (!dto.slug) {
        updateData.slug = await this.generateUniqueSlug(dto.name, id);
      }
    }
    if (dto.slug !== undefined) updateData.slug = await this.generateUniqueSlug(dto.slug, id);
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.purpose !== undefined) updateData.purpose = dto.purpose;
    if (dto.productType !== undefined) updateData.productType = dto.productType;
    if (dto.fields !== undefined) updateData.fields = dto.fields;
    if (dto.successMessage !== undefined) updateData.successMessage = dto.successMessage;
    if (dto.vendorAssignmentMode !== undefined) updateData.vendorAssignmentMode = dto.vendorAssignmentMode;
    if (dto.defaultVendedorId !== undefined) updateData.defaultVendedorId = dto.defaultVendedorId;
    if (dto.roundRobinVendedorIds !== undefined) updateData.roundRobinVendedorIds = dto.roundRobinVendedorIds;
    if (dto.originId !== undefined) updateData.originId = dto.originId;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    return this.prisma.form.update({
      where: { id: form.id },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true } },
        origin: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
    });
  }

  async remove(id: string, currentUserId: string, currentUserRole: UserRole) {
    await this.findOne(id, currentUserId, currentUserRole);

    await this.prisma.form.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    this.logger.log(`🗑️ Form removido: ${id}`);
    return { success: true };
  }

  // ════════════════════════════════════════════════════════════════
  // SUBMISSÕES
  // ════════════════════════════════════════════════════════════════

  async getSubmissions(
    formId: string,
    currentUserId: string,
    currentUserRole: UserRole,
    page = 1,
    limit = 50,
  ) {
    await this.findOne(formId, currentUserId, currentUserRole);

    const [submissions, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where: { formId },
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              score: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.formSubmission.count({ where: { formId } }),
    ]);

    return { submissions, total, page, limit };
  }

  // ════════════════════════════════════════════════════════════════
  // PÚBLICO — sem autenticação
  // ════════════════════════════════════════════════════════════════

  async getPublic(slug: string) {
    const form = await this.prisma.form.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        description: true,
        purpose: true,
        productType: true,
        fields: true,
        successMessage: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (!form || form.deletedAt || !form.isActive) {
      throw new NotFoundException('Formulário não encontrado ou inativo');
    }

    return form;
  }

  async submitPublic(slug: string, data: Record<string, string>, ip?: string) {
    const form = await this.prisma.form.findUnique({
      where: { slug },
    });

    if (!form || form.deletedAt || !form.isActive) {
      throw new NotFoundException('Formulário não encontrado ou inativo');
    }

    // Determinar vendedor responsável
    const vendedorId = await this.resolveVendedor(form);

    if (!vendedorId) {
      throw new BadRequestException('Formulário sem vendedor configurado. Contate o administrador.');
    }

    const vendedor = await this.prisma.user.findUnique({ where: { id: vendedorId } });
    if (!vendedor || !vendedor.isActive) {
      throw new BadRequestException('Vendedor responsável inativo. Contate o administrador.');
    }

    // Mapear campos do form para campos do Lead
    const fieldDefs = (form.fields as unknown as FormFieldDef[]) || [];
    const leadData: Record<string, any> = {
      interestProduct: form.productType || ProductType.ONE_NEXUS,
      originId: form.originId,
      vendedorId,
    };

    for (const field of fieldDefs) {
      const value = data[field.id];
      if (value && field.mappedTo) {
        leadData[field.mappedTo] = value;
      }
    }

    // Validar campos obrigatórios conforme configurado pelo criador do form
    for (const field of fieldDefs) {
      if (field.required && field.mappedTo) {
        const value = data[field.id];
        if (!value || String(value).trim() === '') {
          throw new BadRequestException(`Campo "${field.label}" é obrigatório`);
        }
      }
    }

    // name e email são mínimos para criar um Lead (sem eles não é possível identificar)
    if (!leadData.name) {
      throw new BadRequestException('Campo "Nome" é obrigatório no formulário');
    }
    if (!leadData.email) {
      throw new BadRequestException('Campo "Email" é obrigatório no formulário');
    }

    leadData.cpfCnpj = leadData.cpfCnpj || '00000000000';
    leadData.companyName = leadData.companyName || leadData.name;
    leadData.city = leadData.city || 'Não informada';

    // Mapear label legível → enum ClientRole (forms enviam texto do select, não o enum)
    const roleMap: Record<string, ClientRole> = {
      'ceo / presidente': ClientRole.CEO_PRESIDENTE,
      'ceo/presidente': ClientRole.CEO_PRESIDENTE,
      'sócio ou fundador': ClientRole.SOCIO_FUNDADOR,
      'socio ou fundador': ClientRole.SOCIO_FUNDADOR,
      'sócio': ClientRole.SOCIO_FUNDADOR,
      'socio': ClientRole.SOCIO_FUNDADOR,
      'fundador': ClientRole.SOCIO_FUNDADOR,
      'diretor': ClientRole.DIRETOR,
      'gerente': ClientRole.GERENTE,
      'coordenador': ClientRole.COORDENADOR,
      'supervisor': ClientRole.SUPERVISOR,
      'analista': ClientRole.ANALISTA,
      'recepcionista': ClientRole.RECEPCIONISTA,
      'outro': ClientRole.OUTRO,
    };
    if (leadData.role) {
      const normalized = String(leadData.role).toLowerCase().trim();
      leadData.role = roleMap[normalized]
        ?? (Object.values(ClientRole).includes(leadData.role as ClientRole) ? leadData.role : ClientRole.OUTRO);
    } else {
      leadData.role = ClientRole.OUTRO;
    }

    // Formatar phone (garantir formato esperado pelo DTO)
    if (leadData.phone) {
      const phoneDigits = String(leadData.phone).replace(/\D/g, '');
      if (phoneDigits.length >= 10) {
        const ddd = phoneDigits.substring(0, 2);
        const rest = phoneDigits.substring(2);
        leadData.phone =
          rest.length === 9
            ? `(${ddd}) ${rest.substring(0, 5)}-${rest.substring(5)}`
            : `(${ddd}) ${rest.substring(0, 4)}-${rest.substring(4)}`;
      }
    } else {
      // Phone não coletado no form → placeholder (campo opcional no builder)
      leadData.phone = '(00) 00000-0000';
    }

    // Criar lead via LeadsService (reutiliza toda a lógica existente:
    // score, notificações, estágio padrão, etc.)
    let lead: any;
    try {
      lead = await this.leadsService.create(leadData as any, vendedorId, vendedor.role);
    } catch (err) {
      // Duplicata de email/cpfCnpj — registrar submissão sem lead
      this.logger.warn(`⚠️ Submissão form "${slug}" sem lead: ${err.message}`);
      await this.prisma.formSubmission.create({
        data: { formId: form.id, data: data as any, ipAddress: ip ?? null },
      });
      return {
        success: true,
        message: form.successMessage || 'Obrigado! Entraremos em contato em breve.',
      };
    }

    // Registrar submissão vinculada ao lead
    await this.prisma.formSubmission.create({
      data: {
        formId: form.id,
        leadId: lead.id,
        data: data as any,
        ipAddress: ip ?? null,
      },
    });

    // Atualizar round-robin se necessário
    if (form.vendorAssignmentMode === VendorAssignmentMode.ROUND_ROBIN) {
      const ids = (form.roundRobinVendedorIds as string[]) || [];
      const nextIndex = (form.roundRobinIndex + 1) % Math.max(ids.length, 1);
      await this.prisma.form.update({
        where: { id: form.id },
        data: { roundRobinIndex: nextIndex },
      });
    }

    this.logger.log(`📋 Form "${slug}" submetido → Lead ${lead.id} (${lead.email})`);

    return {
      success: true,
      message: form.successMessage || 'Obrigado! Entraremos em contato em breve.',
    };
  }

  // ════════════════════════════════════════════════════════════════
  // LP EXTERNA — Endpoint dedicado para Landing Pages
  // ════════════════════════════════════════════════════════════════

  async submitFromLP(
    slug: string,
    payload: {
      nome: string;
      clinica?: string;
      cidade?: string;
      whatsapp: string;
      email?: string;
      desafio?: string;
      atendimentos?: string;
    },
    ip?: string,
  ) {
    const form = await this.prisma.form.findUnique({ where: { slug } });

    if (!form || form.deletedAt || !form.isActive) {
      throw new NotFoundException('Formulário não encontrado ou inativo');
    }

    const vendedorId = await this.resolveVendedor(form);
    if (!vendedorId) {
      throw new BadRequestException('Formulário sem vendedor configurado.');
    }

    const vendedor = await this.prisma.user.findUnique({ where: { id: vendedorId } });
    if (!vendedor || !vendedor.isActive) {
      throw new BadRequestException('Vendedor responsável inativo.');
    }

    // Formatar WhatsApp
    const wappDigits = String(payload.whatsapp).replace(/\D/g, '');
    let phone = '(00) 00000-0000';
    if (wappDigits.length >= 10) {
      const ddd = wappDigits.substring(0, 2);
      const rest = wappDigits.substring(2);
      phone =
        rest.length === 9
          ? `(${ddd}) ${rest.substring(0, 5)}-${rest.substring(5)}`
          : `(${ddd}) ${rest.substring(0, 4)}-${rest.substring(4)}`;
    }

    // Email: usar fornecido, ou gerar placeholder a partir do WhatsApp
    const email = payload.email || `${wappDigits}@lp.nexusatemporal.com`;

    // Montar notas com dados extras da LP
    const noteParts: string[] = [];
    if (payload.atendimentos) noteParts.push(`Atendimentos/mês: ${payload.atendimentos}`);
    if (payload.desafio) noteParts.push(`Principal desafio: ${payload.desafio}`);
    const notes = noteParts.length > 0 ? noteParts.join(' | ') : undefined;

    const leadData: Record<string, any> = {
      name: payload.nome,
      email,
      phone,
      companyName: payload.clinica || payload.nome,
      city: payload.cidade || 'Não informada',
      cpfCnpj: '00000000000',
      role: ClientRole.OUTRO,
      interestProduct: form.productType || ProductType.ONE_NEXUS,
      originId: form.originId,
      vendedorId,
      ...(notes ? { notes } : {}),
    };

    // Resolver originId se o form não tem um configurado
    if (!leadData.originId) {
      const lpOrigin = await this.prisma.leadOrigin.findFirst({
        where: { name: { contains: 'Landing Page', mode: 'insensitive' } },
      });
      if (!lpOrigin) {
        const webOrigin = await this.prisma.leadOrigin.findFirst({
          where: { name: { contains: 'Website', mode: 'insensitive' } },
        });
        leadData.originId = webOrigin?.id;
      } else {
        leadData.originId = lpOrigin.id;
      }
    }

    if (!leadData.originId) {
      throw new BadRequestException('Nenhuma origem configurada para este formulário.');
    }

    let lead: any;
    try {
      lead = await this.leadsService.create(leadData as any, vendedorId, vendedor.role);
    } catch (err) {
      this.logger.warn(`⚠️ LP "${slug}" submissão sem lead: ${err.message}`);
      // Registrar submissão mesmo sem lead (duplicata, etc.)
      await this.prisma.formSubmission.create({
        data: { formId: form.id, data: payload as any, ipAddress: ip ?? null },
      });
      return { success: true, message: 'Recebido! Entraremos em contato.' };
    }

    // Registrar submissão vinculada ao lead
    await this.prisma.formSubmission.create({
      data: {
        formId: form.id,
        leadId: lead.id,
        data: payload as any,
        ipAddress: ip ?? null,
      },
    });

    // Round-robin
    if (form.vendorAssignmentMode === VendorAssignmentMode.ROUND_ROBIN) {
      const ids = (form.roundRobinVendedorIds as string[]) || [];
      const nextIndex = (form.roundRobinIndex + 1) % Math.max(ids.length, 1);
      await this.prisma.form.update({
        where: { id: form.id },
        data: { roundRobinIndex: nextIndex },
      });
    }

    this.logger.log(`🚀 LP "${slug}" → Lead ${lead.id} (${lead.email}) — Pipeline OK`);

    return { success: true, leadId: lead.id, message: 'Lead criado no pipeline!' };
  }

  // ════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ════════════════════════════════════════════════════════════════

  private async resolveVendedor(form: any): Promise<string | null> {
    switch (form.vendorAssignmentMode as VendorAssignmentMode) {
      case VendorAssignmentMode.FIXED:
        return form.defaultVendedorId || form.createdById;

      case VendorAssignmentMode.ROUND_ROBIN: {
        const ids = (form.roundRobinVendedorIds as string[]) || [];
        if (ids.length === 0) return form.createdById;
        const index = form.roundRobinIndex % ids.length;
        return ids[index];
      }

      case VendorAssignmentMode.CREATOR:
      default:
        return form.createdById;
    }
  }

  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);

    let slug = base;
    let attempt = 0;

    while (true) {
      const existing = await this.prisma.form.findUnique({
        where: { slug },
      });

      if (!existing || existing.id === excludeId) break;

      attempt++;
      const suffix = randomBytes(3).toString('hex').substring(0, 4);
      slug = `${base}-${suffix}`;
    }

    return slug;
  }
}
