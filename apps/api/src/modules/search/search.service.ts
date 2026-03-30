import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UserRole, LeadStatus, ClientStatus } from '@prisma/client';

export interface SearchResult {
  type: 'lead' | 'client' | 'event';
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    query: string,
    userId: string,
    userRole: UserRole,
  ): Promise<{ leads: SearchResult[]; clients: SearchResult[]; events: SearchResult[] }> {
    const term = query.trim();

    const [leads, clients, events] = await Promise.all([
      this.searchLeads(term, userId, userRole),
      this.searchClients(term, userId, userRole),
      this.searchEvents(term, userId),
    ]);

    return { leads, clients, events };
  }

  private async searchLeads(
    term: string,
    userId: string,
    userRole: UserRole,
  ): Promise<SearchResult[]> {
    // Scoping by role
    const scopeWhere =
      userRole === UserRole.VENDEDOR
        ? { vendedorId: userId }
        : userRole === UserRole.GESTOR
          ? {
              OR: [
                { vendedorId: userId },
                { vendedor: { gestorId: userId } },
              ],
            }
          : {}; // SUPERADMIN / ADMINISTRATIVO

    const results = await this.prisma.lead.findMany({
      where: {
        ...scopeWhere,
        status: LeadStatus.ABERTO,
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          { companyName: { contains: term, mode: 'insensitive' as const } },
          { email: { contains: term, mode: 'insensitive' as const } },
          { cpfCnpj: { contains: term } },
        ],
      },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    return results.map((lead) => ({
      type: 'lead' as const,
      id: lead.id,
      title: lead.name,
      subtitle: lead.companyName || lead.email,
      url: `/leads`,
    }));
  }

  private async searchClients(
    term: string,
    userId: string,
    userRole: UserRole,
  ): Promise<SearchResult[]> {
    // Scoping by role
    const scopeWhere =
      userRole === UserRole.VENDEDOR
        ? { vendedorId: userId }
        : userRole === UserRole.GESTOR
          ? {
              OR: [
                { vendedorId: userId },
                { vendedor: { gestorId: userId } },
              ],
            }
          : {};

    const results = await this.prisma.client.findMany({
      where: {
        ...scopeWhere,
        status: { not: ClientStatus.CANCELADO },
        OR: [
          { contactName: { contains: term, mode: 'insensitive' as const } },
          { company: { contains: term, mode: 'insensitive' as const } },
          { email: { contains: term, mode: 'insensitive' as const } },
          { cpfCnpj: { contains: term } },
        ],
      },
      select: {
        id: true,
        contactName: true,
        company: true,
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    return results.map((client) => ({
      type: 'client' as const,
      id: client.id,
      title: client.contactName,
      subtitle: client.company,
      url: `/clients`,
    }));
  }

  private async searchEvents(
    term: string,
    userId: string,
  ): Promise<SearchResult[]> {
    const results = await this.prisma.calendarEvent.findMany({
      where: {
        userId,
        deletedAt: null,
        OR: [
          { title: { contains: term, mode: 'insensitive' as const } },
          { description: { contains: term, mode: 'insensitive' as const } },
        ],
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        type: true,
      },
      take: 5,
      orderBy: { startAt: 'desc' },
    });

    return results.map((event) => ({
      type: 'event' as const,
      id: event.id,
      title: event.title,
      subtitle: new Date(event.startAt).toLocaleDateString('pt-BR'),
      url: `/calendar`,
    }));
  }
}
