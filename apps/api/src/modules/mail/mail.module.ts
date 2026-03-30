import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * MailModule - Global para uso em qualquer módulo
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
