/**
 * @hmc/notifications - Multi-channel notification delivery
 *
 * Provides:
 * - In-app notifications with DB adapter pattern
 * - Email via SMTP (SendGrid, SES, Office365, custom)
 * - Teams webhook delivery
 * - HTML email templating with XSS escaping
 * - Notification expiration and cleanup
 */

import nodemailer from 'nodemailer';
import { createLogger } from '@hmc/logger';

const logger = createLogger('notifications');

// ── Types ───────────────────────────────────────────────────────

export type NotificationChannel = 'in_app' | 'email' | 'teams' | 'all';

export interface NotificationInput {
  userId?: string;
  tenantId?: string;
  type: string;
  title: string;
  message: string;
  channel?: NotificationChannel;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  fromAddress: string;
  fromName?: string;
}

export interface NotificationDbAdapter {
  createNotification(input: NotificationInput & { id: string }): Promise<void>;
  getUserEmail(userId: string): Promise<string | null>;
  getAdminUserIds(tenantId: string): Promise<string[]>;
  getNotifications(userId: string, options: { unreadOnly?: boolean; limit?: number; offset?: number }): Promise<{ notifications: unknown[]; total: number; unreadCount: number }>;
  markAsRead(notificationId: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<number>;
  deleteNotification(notificationId: string, userId: string): Promise<void>;
  cleanupExpired(): Promise<number>;
  getUnreadCount(userId: string): Promise<number>;
}

// ── Service ─────────────────────────────────────────────────────

let dbAdapter: NotificationDbAdapter | null = null;
let smtpConfig: SmtpConfig | null = null;
let teamsWebhookUrl: string | null = null;
let mailTransporter: nodemailer.Transporter | null = null;

export function initNotifications(config: {
  db: NotificationDbAdapter;
  smtp?: SmtpConfig;
  teamsWebhookUrl?: string;
}): void {
  dbAdapter = config.db;
  smtpConfig = config.smtp || null;
  teamsWebhookUrl = config.teamsWebhookUrl || null;
  mailTransporter = null;
}

function getDb(): NotificationDbAdapter {
  if (!dbAdapter) throw new Error('Notifications not initialized. Call initNotifications() first.');
  return dbAdapter;
}

function getMailTransporter(): nodemailer.Transporter | null {
  if (mailTransporter) return mailTransporter;
  if (!smtpConfig) return null;

  mailTransporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure ?? smtpConfig.port === 465,
    auth: smtpConfig.user && smtpConfig.pass ? { user: smtpConfig.user, pass: smtpConfig.pass } : undefined,
  });

  return mailTransporter;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getColorForType(type: string): string {
  if (type.includes('error') || type.includes('exceeded') || type.includes('violation') || type.includes('down')) return 'FF0000';
  if (type.includes('warning') || type.includes('escalation')) return 'FFA500';
  if (type.includes('complete') || type.includes('recovered') || type.includes('success')) return '00FF00';
  return '0078D4';
}

function buildEmailHtml(input: NotificationInput): string {
  const color = getColorForType(input.type);
  const safeTitle = escapeHtml(input.title);
  const safeMessage = escapeHtml(input.message);
  const safeType = escapeHtml(input.type.replace(/_/g, ' '));

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #${color}; padding: 4px;"></div>
      <div style="padding: 24px; background: #f9f9f9;">
        <h2 style="margin: 0 0 8px 0; color: #1a1a1a;">${safeTitle}</h2>
        <span style="font-size: 12px; color: #666; text-transform: uppercase;">${safeType}</span>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 16px 0;" />
        <p style="color: #333; line-height: 1.6;">${safeMessage}</p>
        ${input.metadata ? `
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            ${Object.entries(input.metadata).map(([key, value]) => `
              <tr>
                <td style="padding: 4px 8px; color: #666; font-size: 13px;">${escapeHtml(key)}</td>
                <td style="padding: 4px 8px; color: #333; font-size: 13px;">${escapeHtml(String(value))}</td>
              </tr>
            `).join('')}
          </table>
        ` : ''}
      </div>
    </div>
  `;
}

async function sendEmail(input: NotificationInput): Promise<void> {
  const transporter = getMailTransporter();
  if (!transporter || !smtpConfig) {
    logger.info('Email skipped (SMTP not configured)', { type: input.type });
    return;
  }

  let recipientEmail: string | null = null;
  if (input.userId) {
    recipientEmail = await getDb().getUserEmail(input.userId);
  }

  if (!recipientEmail) {
    logger.warn('Cannot send email: no recipient', { userId: input.userId });
    return;
  }

  await transporter.sendMail({
    from: `"${smtpConfig.fromName || 'HMC'}" <${smtpConfig.fromAddress}>`,
    to: recipientEmail,
    subject: input.title,
    text: input.message,
    html: buildEmailHtml(input),
  });

  logger.info('Email sent', { to: recipientEmail, type: input.type });
}

async function sendTeams(input: NotificationInput): Promise<void> {
  if (!teamsWebhookUrl) return;

  try {
    const card = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: getColorForType(input.type),
      summary: input.title,
      sections: [{
        activityTitle: input.title,
        activitySubtitle: input.type.replace(/_/g, ' ').toUpperCase(),
        text: input.message,
        facts: input.metadata ? Object.entries(input.metadata).map(([key, value]) => ({ name: key, value: String(value) })) : [],
      }],
    };

    await fetch(teamsWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
  } catch (error) {
    logger.error('Teams webhook delivery failed', { error });
  }
}

// ── Public API ──────────────────────────────────────────────────

export async function notify(input: NotificationInput): Promise<string> {
  const id = crypto.randomUUID();
  await getDb().createNotification({ ...input, id });

  logger.info('Notification created', { id, type: input.type, userId: input.userId });

  if (input.channel === 'email' || input.channel === 'all') {
    await sendEmail(input).catch(err => logger.error('Email delivery failed', { error: err }));
  }
  if (input.channel === 'teams' || input.channel === 'all') {
    await sendTeams(input).catch(err => logger.error('Teams delivery failed', { error: err }));
  }

  return id;
}

export async function notifyAdmins(
  tenantId: string,
  input: Omit<NotificationInput, 'userId' | 'tenantId'>
): Promise<string[]> {
  const adminIds = await getDb().getAdminUserIds(tenantId);
  const ids: string[] = [];
  for (const adminId of adminIds) {
    const id = await notify({ ...input, userId: adminId, tenantId });
    ids.push(id);
  }
  return ids;
}

export async function getNotifications(userId: string, options?: { unreadOnly?: boolean; limit?: number; offset?: number }) {
  return getDb().getNotifications(userId, options || {});
}

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  return getDb().markAsRead(notificationId, userId);
}

export async function markAllAsRead(userId: string): Promise<number> {
  return getDb().markAllAsRead(userId);
}

export async function deleteNotification(notificationId: string, userId: string): Promise<void> {
  return getDb().deleteNotification(notificationId, userId);
}

export async function cleanupExpired(): Promise<number> {
  return getDb().cleanupExpired();
}

export async function getUnreadCount(userId: string): Promise<number> {
  return getDb().getUnreadCount(userId);
}
