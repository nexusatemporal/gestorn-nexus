import { PrismaClient, UserRole, ProductType, ClientStatus, TenantStatus, StatusEntity } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // ========================================================================
  // PLANS - Planos de Assinatura
  // ========================================================================
  console.log('📋 Creating plans...');

  const planOneNexusBasic = await prisma.plan.upsert({
    where: { id: 'plan-one-nexus-basic' },
    update: {},
    create: {
      id: 'plan-one-nexus-basic',
      name: 'One Nexus Basic',
      code: 'ONE-BASIC',
      product: ProductType.ONE_NEXUS,
      priceMonthly: 199.90,
      priceAnnual: 2158.92,  // ✅ v2.42.2: (199.90 * 0.9) * 12 = 2158.92
      isActive: true,
    },
  });

  const planOneNexusPro = await prisma.plan.upsert({
    where: { id: 'plan-one-nexus-pro' },
    update: {},
    create: {
      id: 'plan-one-nexus-pro',
      name: 'One Nexus Pro',
      code: 'ONE-PRO',
      product: ProductType.ONE_NEXUS,
      priceMonthly: 450.00,
      priceAnnual: 4860.00,  // ✅ v2.42.2: (450.00 * 0.9) * 12 = 4860.00
      isActive: true,
    },
  });

  const planOneNexusEnterprise = await prisma.plan.upsert({
    where: { id: 'plan-one-nexus-enterprise' },
    update: {},
    create: {
      id: 'plan-one-nexus-enterprise',
      name: 'One Nexus Enterprise',
      code: 'ONE-ENTERPRISE',
      product: ProductType.ONE_NEXUS,
      priceMonthly: 850.00,
      priceAnnual: 9180.00,  // ✅ v2.42.2: (850.00 * 0.9) * 12 = 9180.00
      isActive: true,
    },
  });

  const planLocadorasStandard = await prisma.plan.upsert({
    where: { id: 'plan-locadoras-standard' },
    update: {},
    create: {
      id: 'plan-locadoras-standard',
      name: 'Locadoras Standard',
      code: 'LOC-STANDARD',
      product: ProductType.LOCADORAS,
      priceMonthly: 1200.00,
      priceAnnual: 12960.00,  // ✅ v2.42.2: (1200.00 * 0.9) * 12 = 12960.00
      isActive: true,
    },
  });

  const planLocadorasGold = await prisma.plan.upsert({
    where: { id: 'plan-locadoras-gold' },
    update: {},
    create: {
      id: 'plan-locadoras-gold',
      name: 'Locadoras Gold',
      code: 'LOC-GOLD',
      product: ProductType.LOCADORAS,
      priceMonthly: 397.00,
      priceAnnual: 4287.60,  // ✅ v2.46.0: (397.00 * 0.9) * 12 = 4287.60
      isActive: true,
    },
  });

  console.log(`✅ Created 5 plans`);

  // ========================================================================
  // USERS - Usuarios Internos (v2.54.0: Auth proprio JWT com passwordHash)
  // ========================================================================
  console.log('Creating users...');

  const adminPasswordHash = await bcrypt.hash('Nexus@2025', 10);
  const vendedorPasswordHash = await bcrypt.hash('Vendedor@2025', 10);

  const userAdmin = await prisma.user.upsert({
    where: { email: 'admin@nexusatemporal.com.br' },
    update: { passwordHash: adminPasswordHash },
    create: {
      id: 'user-admin-001',
      email: 'admin@nexusatemporal.com.br',
      name: 'Admin Nexus',
      role: UserRole.SUPERADMIN,
      isActive: true,
      passwordHash: adminPasswordHash,
    },
  });

  // Seed admin user com email alternativo (v2.54.0)
  await prisma.user.upsert({
    where: { email: 'admin@nexusatemporal.com' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'admin@nexusatemporal.com',
      name: 'Admin Nexus',
      role: UserRole.SUPERADMIN,
      isActive: true,
      passwordHash: adminPasswordHash,
    },
  });
  console.log('Usuario admin criado/atualizado com senha hash');

  const userVendedor1 = await prisma.user.upsert({
    where: { email: 'vendedor1@nexusatemporal.com.br' },
    update: { passwordHash: vendedorPasswordHash },
    create: {
      id: 'user-vendedor-001',
      email: 'vendedor1@nexusatemporal.com.br',
      name: 'Carlos Vendedor',
      role: UserRole.VENDEDOR,
      isActive: true,
      passwordHash: vendedorPasswordHash,
    },
  });

  const userVendedor2 = await prisma.user.upsert({
    where: { email: 'vendedor2@nexusatemporal.com.br' },
    update: { passwordHash: vendedorPasswordHash },
    create: {
      id: 'user-vendedor-002',
      email: 'vendedor2@nexusatemporal.com.br',
      name: 'Maria Vendedora',
      role: UserRole.VENDEDOR,
      isActive: true,
      passwordHash: vendedorPasswordHash,
    },
  });

  console.log('Created 3+ users with password hashes');

  // ========================================================================
  // LEAD ORIGINS - Origens de Leads
  // ========================================================================
  console.log('📍 Creating lead origins...');

  const originWebsite = await prisma.leadOrigin.upsert({
    where: { name: 'Website' },
    update: {},
    create: {
      name: 'Website',
      description: 'Lead originado do website/formulário de contato',
      isActive: true,
    },
  });

  const originIndicacao = await prisma.leadOrigin.upsert({
    where: { name: 'Indicação' },
    update: {},
    create: {
      name: 'Indicação',
      description: 'Lead indicado por cliente ou parceiro',
      isActive: true,
    },
  });

  const originRedesSociais = await prisma.leadOrigin.upsert({
    where: { name: 'Redes Sociais' },
    update: {},
    create: {
      name: 'Redes Sociais',
      description: 'Lead vindo de redes sociais (Instagram, Facebook, LinkedIn)',
      isActive: true,
    },
  });

  const originEmailMarketing = await prisma.leadOrigin.upsert({
    where: { name: 'Email Marketing' },
    update: {},
    create: {
      name: 'Email Marketing',
      description: 'Lead de campanha de email marketing',
      isActive: true,
    },
  });

  const originEvento = await prisma.leadOrigin.upsert({
    where: { name: 'Evento' },
    update: {},
    create: {
      name: 'Evento',
      description: 'Lead captado em evento/feira',
      isActive: true,
    },
  });

  const originColdCall = await prisma.leadOrigin.upsert({
    where: { name: 'Cold Call' },
    update: {},
    create: {
      name: 'Cold Call',
      description: 'Lead de prospecção ativa (cold calling)',
      isActive: true,
    },
  });

  const originOutro = await prisma.leadOrigin.upsert({
    where: { name: 'Outro' },
    update: {},
    create: {
      name: 'Outro',
      description: 'Outras origens não especificadas',
      isActive: true,
    },
  });

  const originChatNexus = await prisma.leadOrigin.upsert({
    where: { name: 'Chat Nexus' },
    update: {},
    create: {
      name: 'Chat Nexus',
      description: 'Leads originados do Chat Nexus (WhatsApp/Web)',
      isActive: true,
    },
  });

  console.log(`✅ Created 8 lead origins`);

  // ========================================================================
  // FUNNEL STAGES - Etapas do Funil de Vendas
  // ========================================================================
  console.log('🎯 Creating funnel stages...');

  const stageAberto = await prisma.funnelStage.upsert({
    where: { name: 'Aberto' },
    update: {},
    create: {
      name: 'Aberto',
      order: 1,
      color: '#94A3B8', // slate-400
      isDefault: true,
      isActive: true,
    },
  });

  const stageEmContato = await prisma.funnelStage.upsert({
    where: { name: 'Em Contato' },
    update: {},
    create: {
      name: 'Em Contato',
      order: 2,
      color: '#60A5FA', // blue-400
      isActive: true,
    },
  });

  const stageQualificado = await prisma.funnelStage.upsert({
    where: { name: 'Qualificado' },
    update: {},
    create: {
      name: 'Qualificado',
      order: 3,
      color: '#A78BFA', // violet-400
      isActive: true,
    },
  });

  const stageProposta = await prisma.funnelStage.upsert({
    where: { name: 'Proposta' },
    update: {},
    create: {
      name: 'Proposta',
      order: 4,
      color: '#FBBF24', // amber-400
      isActive: true,
    },
  });

  const stageNegociacao = await prisma.funnelStage.upsert({
    where: { name: 'Negociação' },
    update: {},
    create: {
      name: 'Negociação',
      order: 5,
      color: '#FF7300', // nexus-orange
      isActive: true,
    },
  });

  const stageGanho = await prisma.funnelStage.upsert({
    where: { name: 'Ganho' },
    update: {},
    create: {
      name: 'Ganho',
      order: 6,
      color: '#34D399', // green-400
      isActive: true,
    },
  });

  const stagePerdido = await prisma.funnelStage.upsert({
    where: { name: 'Perdido' },
    update: {},
    create: {
      name: 'Perdido',
      order: 7,
      color: '#F87171', // red-400
      isActive: true,
    },
  });

  console.log(`✅ Created 7 funnel stages`);

  // ========================================================================
  // CLIENTS - Clientes (mesmos do mock do frontend)
  // ========================================================================
  console.log('🏢 Creating clients...');

  const client1 = await prisma.client.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      company: 'Estética Glow',
      contactName: 'Juliana Mendes',
      cpfCnpj: '12345678000190',
      email: 'contato@glow.com.br',
      phone: '11999999999',
      productType: ProductType.ONE_NEXUS,
      planId: planOneNexusEnterprise.id,
      vendedorId: userVendedor1.id,
      status: ClientStatus.ATIVO,
      createdAt: new Date('2024-01-05'),
    },
  });

  const client2 = await prisma.client.create({
    data: {
      id: '661e8400-e29b-41d4-a716-446655440011',
      company: 'DermaCare Centro',
      contactName: 'Dr. Roberto Santos',
      cpfCnpj: '98765432000110',
      email: 'contato@dermacare.com.br',
      phone: '11988888888',
      productType: ProductType.ONE_NEXUS,
      planId: planOneNexusPro.id,
      vendedorId: userVendedor1.id,
      status: ClientStatus.INADIMPLENTE,
      createdAt: new Date('2023-12-10'),
    },
  });

  const client3 = await prisma.client.create({
    data: {
      id: '772e8400-e29b-41d4-a716-446655440022',
      company: 'LocaTech Equipamentos',
      contactName: 'Fernanda Lima',
      cpfCnpj: '11222333000144',
      email: 'contato@locatech.com.br',
      phone: '11977777777',
      productType: ProductType.LOCADORAS,
      planId: planLocadorasStandard.id,
      vendedorId: userVendedor2.id,
      status: ClientStatus.ATIVO,
      createdAt: new Date('2024-01-08'),
    },
  });

  console.log(`✅ Created 3 clients`);

  // ========================================================================
  // TENANTS - Instâncias dos clientes
  // ========================================================================
  console.log('🗄️ Creating tenants...');

  await prisma.tenant.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      clientId: client1.id,
      name: 'Estética Glow',
      tenantUuid: '550e8400-e29b-41d4-a716-446655440000',
      systemUrl: 'glow.onenexus.com.br',
      vpsLocation: 'VPS Final 29',
      status: TenantStatus.ATIVO,
      version: 'v2.4.1',
    },
  });

  await prisma.tenant.create({
    data: {
      id: '661e8400-e29b-41d4-a716-446655440011',
      clientId: client2.id,
      name: 'DermaCare Centro',
      tenantUuid: '661e8400-e29b-41d4-a716-446655440011',
      systemUrl: 'dermacare.onenexus.com.br',
      vpsLocation: 'VPS Final 145',
      status: TenantStatus.ATIVO,
      version: 'v2.3.8',
    },
  });

  await prisma.tenant.create({
    data: {
      id: '772e8400-e29b-41d4-a716-446655440022',
      clientId: client3.id,
      name: 'LocaTech Equipamentos',
      tenantUuid: '772e8400-e29b-41d4-a716-446655440022',
      systemUrl: 'locatech.locadoras.com.br',
      vpsLocation: 'VPS Final 29',
      status: TenantStatus.ATIVO,
      version: 'v4.1.0',
    },
  });

  console.log(`✅ Created 3 tenants`);

  // ========================================================================
  // STATUS CONFIGS — Labels e cores para todos os status do sistema
  // ========================================================================
  console.log('🏷️  Creating status configs...');

  const statusConfigs = [
    // CLIENT statuses
    { entity: StatusEntity.CLIENT, slug: 'EM_TRIAL',     label: 'Em Trial',     color: '#3b82f6', bgColor: '#dbeafe', isSystem: true, sortOrder: 0 },
    { entity: StatusEntity.CLIENT, slug: 'ATIVO',        label: 'Ativo',        color: '#16a34a', bgColor: '#dcfce7', isSystem: true, sortOrder: 1 },
    { entity: StatusEntity.CLIENT, slug: 'INADIMPLENTE', label: 'Inadimplente', color: '#dc2626', bgColor: '#fee2e2', isSystem: true, sortOrder: 2 },
    { entity: StatusEntity.CLIENT, slug: 'BLOQUEADO',    label: 'Bloqueado',    color: '#ea580c', bgColor: '#ffedd5', isSystem: true, sortOrder: 3 },
    { entity: StatusEntity.CLIENT, slug: 'CANCELADO',    label: 'Cancelado',    color: '#6b7280', bgColor: '#f3f4f6', isSystem: true, sortOrder: 4 },

    // LEAD statuses
    { entity: StatusEntity.LEAD, slug: 'ABERTO',      label: 'Aberto',      color: '#3b82f6', bgColor: '#dbeafe', isSystem: true, sortOrder: 0 },
    { entity: StatusEntity.LEAD, slug: 'CONTATADO',   label: 'Contatado',   color: '#7c3aed', bgColor: '#ede9fe', isSystem: true, sortOrder: 1 },
    { entity: StatusEntity.LEAD, slug: 'QUALIFICADO', label: 'Qualificado', color: '#d97706', bgColor: '#fef3c7', isSystem: true, sortOrder: 2 },
    { entity: StatusEntity.LEAD, slug: 'GANHO',       label: 'Ganho',       color: '#16a34a', bgColor: '#dcfce7', isSystem: true, sortOrder: 3 },
    { entity: StatusEntity.LEAD, slug: 'PERDIDO',     label: 'Perdido',     color: '#dc2626', bgColor: '#fee2e2', isSystem: true, sortOrder: 4 },
    { entity: StatusEntity.LEAD, slug: 'DESISTIU',    label: 'Desistiu',    color: '#6b7280', bgColor: '#f3f4f6', isSystem: true, sortOrder: 5 },

    // SUBSCRIPTION statuses
    { entity: StatusEntity.SUBSCRIPTION, slug: 'ACTIVE',   label: 'Ativa',        color: '#16a34a', bgColor: '#dcfce7', isSystem: true, sortOrder: 0 },
    { entity: StatusEntity.SUBSCRIPTION, slug: 'TRIALING', label: 'Em Trial',     color: '#3b82f6', bgColor: '#dbeafe', isSystem: true, sortOrder: 1 },
    { entity: StatusEntity.SUBSCRIPTION, slug: 'PAST_DUE', label: 'Inadimplente', color: '#dc2626', bgColor: '#fee2e2', isSystem: true, sortOrder: 2 },
    { entity: StatusEntity.SUBSCRIPTION, slug: 'CANCELED', label: 'Cancelada',    color: '#6b7280', bgColor: '#f3f4f6', isSystem: true, sortOrder: 3 },
    { entity: StatusEntity.SUBSCRIPTION, slug: 'PAUSED',   label: 'Pausada',      color: '#ea580c', bgColor: '#ffedd5', isSystem: true, sortOrder: 4 },

    // TENANT statuses
    { entity: StatusEntity.TENANT, slug: 'ATIVO',    label: 'Ativo',     color: '#16a34a', bgColor: '#dcfce7', isSystem: true, sortOrder: 0 },
    { entity: StatusEntity.TENANT, slug: 'SUSPENSO', label: 'Suspenso',  color: '#ea580c', bgColor: '#ffedd5', isSystem: true, sortOrder: 1 },
    { entity: StatusEntity.TENANT, slug: 'BLOQUEADO',label: 'Bloqueado', color: '#dc2626', bgColor: '#fee2e2', isSystem: true, sortOrder: 2 },
    { entity: StatusEntity.TENANT, slug: 'DELETADO', label: 'Deletado',  color: '#6b7280', bgColor: '#f3f4f6', isSystem: true, sortOrder: 3 },
  ];

  for (const config of statusConfigs) {
    await prisma.statusConfig.upsert({
      where: { entity_slug: { entity: config.entity, slug: config.slug } },
      update: { label: config.label, color: config.color, bgColor: config.bgColor },
      create: config,
    });
  }

  console.log(`✅ Created ${statusConfigs.length} status configs`);

  console.log('');
  console.log('✅ Seed completed successfully!');
  console.log('');
  console.log('📊 Database summary:');
  console.log(`   - Plans: 5`);
  console.log(`   - Users: 3`);
  console.log(`   - Lead Origins: 7`);
  console.log(`   - Funnel Stages: 7`);
  console.log(`   - Clients: 3`);
  console.log(`   - Tenants: 3`);
  console.log(`   - Status Configs: ${statusConfigs.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
