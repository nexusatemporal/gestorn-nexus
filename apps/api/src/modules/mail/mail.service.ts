import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * MAIL SERVICE - Envio de emails via SMTP (Zoho)
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'smtp.zoho.com'),
      port: Number(this.config.get('SMTP_PORT', '587')),
      secure: false, // STARTTLS na porta 587
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Envia email de boas-vindas ao criar um novo usuário
   */
  async sendWelcomeEmail(params: {
    to: string;
    name: string;
    password?: string;
    role: string;
  }): Promise<void> {
    const { to, name, password, role } = params;
    const fromAddress = this.config.get('SMTP_FROM', 'Gestor Nexus <contato@nexusatemporal.com.br>');
    const appUrl = this.config.get('WEB_URL', 'https://gestornx.nexusatemporal.com');

    const roleLabels: Record<string, string> = {
      SUPERADMIN: 'Super Admin',
      ADMINISTRATIVO: 'Administrativo',
      GESTOR: 'Gestor',
      VENDEDOR: 'Vendedor',
      DESENVOLVEDOR: 'Desenvolvedor',
    };

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao Gestor Nexus</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#FF7300,#cc5a00);padding:40px 40px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">Gestor Nexus</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:1px;text-transform:uppercase;">Nexus Atemporal</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;color:#18181b;font-size:22px;font-weight:700;">Olá, ${name}!</h2>
              <p style="margin:0 0 24px;color:#71717a;font-size:15px;line-height:1.6;">
                Sua conta no <strong>Gestor Nexus</strong> foi criada com sucesso. Abaixo estão suas credenciais de acesso:
              </p>

              <!-- Credenciais -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9fb;border:1px solid #e4e4e7;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;">
                          <span style="color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Email</span><br>
                          <span style="color:#18181b;font-size:15px;font-weight:500;font-family:monospace;">${to}</span>
                        </td>
                      </tr>
                      ${password ? `
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;">
                          <span style="color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Senha</span><br>
                          <span style="color:#18181b;font-size:15px;font-weight:500;font-family:monospace;">${password}</span>
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Perfil de Acesso</span><br>
                          <span style="color:#FF7300;font-size:15px;font-weight:700;">${roleLabels[role] || role}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${!password ? `
              <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0;color:#9a3412;font-size:13px;line-height:1.5;">
                  <strong>Atenção:</strong> Nenhuma senha foi definida para sua conta. Entre em contato com o administrador para configurar sua senha de acesso.
                </p>
              </div>` : ''}

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${appUrl}" style="display:inline-block;background:#FF7300;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;letter-spacing:0.3px;">
                      Acessar o Sistema →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.6;text-align:center;">
                Por segurança, recomendamos alterar sua senha no primeiro acesso.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f4f4f5;padding:20px 40px;text-align:center;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;">
                © ${new Date().getFullYear()} Nexus Atemporal · Sistema Interno de Gestão
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject: `Bem-vindo ao Gestor Nexus, ${name}!`,
        html,
      });
      this.logger.log(`Email de boas-vindas enviado para ${to}`);
    } catch (error) {
      this.logger.error(`Falha ao enviar email para ${to}: ${error.message}`);
      // Não lança exceção - falha de email não deve bloquear criação do usuário
    }
  }

  /**
   * Envia email de alerta para notificações críticas (PAYMENT_OVERDUE, AI_CHURN_ALERT, SYSTEM_ALERT)
   */
  async sendNotificationEmail(params: {
    to: string;
    name: string;
    title: string;
    message: string;
    type: string;
    link?: string;
  }): Promise<void> {
    const { to, name, title, message, type, link } = params;
    const fromAddress = this.config.get('SMTP_FROM', 'Gestor Nexus <contato@nexusatemporal.com.br>');
    const appUrl = this.config.get('WEB_URL', 'https://gestornx.nexusatemporal.com');

    const typeStyles: Record<string, { bg: string; border: string; text: string; label: string; emoji: string }> = {
      PAYMENT_OVERDUE:  { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', label: 'Pagamento em Atraso', emoji: '⚠️' },
      AI_CHURN_ALERT:   { bg: '#FFF7ED', border: '#FED7AA', text: '#EA580C', label: 'Risco de Churn',      emoji: '🔴' },
      SYSTEM_ALERT:     { bg: '#FEFCE8', border: '#FDE047', text: '#CA8A04', label: 'Alerta do Sistema',   emoji: '🚨' },
    };

    const style = typeStyles[type] ?? { bg: '#F4F4F5', border: '#E4E4E7', text: '#71717A', label: 'Notificação', emoji: '🔔' };
    const actionUrl = link ? `${appUrl}${link}` : appUrl;

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#FF7300,#cc5a00);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">Gestor Nexus</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:1px;text-transform:uppercase;">Nexus Atemporal</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 20px;color:#71717a;font-size:14px;">Olá, <strong>${name}</strong>!</p>
              <div style="background:${style.bg};border:1px solid ${style.border};border-radius:12px;padding:20px 24px;margin-bottom:24px;">
                <p style="margin:0 0 4px;color:${style.text};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${style.emoji} ${style.label}</p>
                <p style="margin:6px 0 0;color:#18181b;font-size:17px;font-weight:700;">${title}</p>
                <p style="margin:8px 0 0;color:#52525b;font-size:14px;line-height:1.6;">${message}</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${actionUrl}" style="display:inline-block;background:#FF7300;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 32px;border-radius:10px;">
                      Ver no Sistema →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f4f4f5;padding:16px 40px;text-align:center;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;">© ${new Date().getFullYear()} Nexus Atemporal · Sistema Interno de Gestão</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject: `${style.emoji} ${title} — Gestor Nexus`,
        html,
      });
      this.logger.log(`Email de alerta enviado para ${to} (${type})`);
    } catch (error) {
      this.logger.error(`Falha ao enviar email de alerta para ${to}: ${error.message}`);
    }
  }

  /**
   * Envia email de digest diário com resumo de notificações não lidas (v2.59.0)
   */
  async sendDigestEmail(params: {
    to: string;
    name: string;
    count: number;
    notifications: Array<{ title: string; message: string; type: string; createdAt: Date }>;
  }): Promise<void> {
    const { to, name, count, notifications } = params;
    const fromAddress = this.config.get('SMTP_FROM', 'Gestor Nexus <contato@nexusatemporal.com.br>');
    const appUrl = this.config.get('WEB_URL', 'https://gestornx.nexusatemporal.com');

    const typeEmojis: Record<string, string> = {
      PAYMENT_RECEIVED:      '💰',
      PAYMENT_OVERDUE:       '⚠️',
      SUBSCRIPTION_EXPIRING: '⏰',
      NEW_LEAD:              '🎯',
      LEAD_ASSIGNED:         '👤',
      LEAD_CONVERTED:        '✅',
      AI_CHURN_ALERT:        '🔴',
      AI_OPPORTUNITY:        '⚡',
      AI_LEAD_SCORE:         '📊',
      SYSTEM_UPDATE:         'ℹ️',
      SYSTEM_ALERT:          '🚨',
    };

    const itemsHtml = notifications
      .map((n) => {
        const emoji = typeEmojis[n.type] ?? '🔔';
        const time = new Intl.DateTimeFormat('pt-BR', {
          hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
        }).format(new Date(n.createdAt));
        return `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:28px;vertical-align:top;padding-top:2px;">
                    <span style="font-size:16px;">${emoji}</span>
                  </td>
                  <td style="padding-left:8px;">
                    <p style="margin:0;color:#18181b;font-size:14px;font-weight:600;">${n.title}</p>
                    <p style="margin:4px 0 0;color:#71717a;font-size:13px;line-height:1.4;">${n.message}</p>
                  </td>
                  <td style="width:40px;text-align:right;vertical-align:top;color:#a1a1aa;font-size:11px;white-space:nowrap;">${time}</td>
                </tr>
              </table>
            </td>
          </tr>`;
      })
      .join('');

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resumo de Notificações</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#FF7300,#cc5a00);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">Gestor Nexus</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:1px;text-transform:uppercase;">Resumo Diário</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="margin:0 0 4px;color:#18181b;font-size:20px;font-weight:700;">Bom dia, ${name}!</h2>
              <p style="margin:0 0 24px;color:#71717a;font-size:14px;">
                Você tem <strong style="color:#FF7300;">${count} notificação${count > 1 ? 'ões' : ''} não lida${count > 1 ? 's' : ''}</strong> das últimas 24 horas.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${itemsHtml}
              </table>
              ${count > 10 ? `<p style="margin:16px 0 0;color:#a1a1aa;font-size:12px;text-align:center;">Exibindo as 10 mais recentes de ${count} notificações.</p>` : ''}
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/notifications" style="display:inline-block;background:#FF7300;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 32px;border-radius:10px;">
                      Ver todas as notificações →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f4f4f5;padding:16px 40px;text-align:center;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;">© ${new Date().getFullYear()} Nexus Atemporal · Sistema Interno de Gestão</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject: `🔔 ${count} notificação${count > 1 ? 'ões' : ''} não lida${count > 1 ? 's' : ''} — Gestor Nexus`,
        html,
      });
      this.logger.log(`Digest enviado para ${to} (${count} notificações)`);
    } catch (error) {
      this.logger.error(`Falha ao enviar digest para ${to}: ${error.message}`);
    }
  }

  /**
   * Verifica a conexão SMTP
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('Conexão SMTP verificada com sucesso');
      return true;
    } catch (error) {
      this.logger.error(`Falha na conexão SMTP: ${error.message}`);
      return false;
    }
  }
}
