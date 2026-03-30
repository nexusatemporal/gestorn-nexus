import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard para endpoints da Partner API (chamados pelo Chat Nexus).
 * Valida X-Client-Id + X-Client-Secret nos headers.
 */
@Injectable()
export class PartnerApiGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const clientId = request.headers['x-client-id'];
    const clientSecret = request.headers['x-client-secret'];

    const expectedId = this.configService.get<string>(
      'CHAT_NEXUS_CLIENT_ID',
      'nxc_partner_gestornexus',
    );
    const expectedSecret = this.configService.get<string>(
      'CHAT_NEXUS_CLIENT_SECRET',
      '',
    );

    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('Missing X-Client-Id or X-Client-Secret');
    }

    if (clientId !== expectedId || clientSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid partner credentials');
    }

    return true;
  }
}
