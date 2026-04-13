import { google } from 'googleapis';

// ─── Auth avec token utilisateur ─────────────────────────────────────────────

function getGmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

// ─── Personnalisation du template ────────────────────────────────────────────

/**
 * Remplace {{NomColonne}} par la valeur du contact
 * Ex: {{prénom}} → "Marie"
 */
export function personalizeTemplate(
  html: string,
  subject: string,
  contactData: Record<string, string>
): { html: string; subject: string } {
  let out = html;
  let subj = subject;

  for (const [key, value] of Object.entries(contactData)) {
    const regex = new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g');
    out = out.replace(regex, value || '');
    subj = subj.replace(regex, value || '');
  }

  return { html: out, subject: subj };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

/** Enveloppe les liens pour le tracking de clics */
export function wrapLinks(html: string, contactId: string, appUrl: string): string {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (match, url: string) => {
      if (url.includes(appUrl)) return match;
      const encoded = encodeURIComponent(url);
      return `href="${appUrl}/api/click?id=${contactId}&url=${encoded}"`;
    }
  );
}

/** Ajoute un pixel de tracking invisible */
export function addTrackingPixel(html: string, contactId: string, appUrl: string): string {
  const pixel = `<img src="${appUrl}/api/open?id=${contactId}" width="1" height="1" style="display:none;" alt="">`;
  // Insérer avant </body> si présent, sinon à la fin
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`);
  }
  return html + pixel;
}

// ─── Construction du message MIME ────────────────────────────────────────────

function buildMimeMessage(
  from: string,
  fromName: string,
  to: string,
  subject: string,
  htmlBody: string,
  threadId?: string
): string {
  const boundary = `ekke_${Date.now()}_boundary`;
  const encodedSubject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const fromHeader = `"${fromName}" <${from}>`;

  const parts = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ...(threadId ? [`In-Reply-To: ${threadId}`, `References: ${threadId}`] : []),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Ce mail nécessite un client mail supportant le HTML.',
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ];

  return parts.join('\r\n');
}

// ─── Envoi ────────────────────────────────────────────────────────────────────

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

export async function sendEmail(
  accessToken: string,
  opts: {
    from: string;
    fromName: string;
    to: string;
    subject: string;
    htmlBody: string;
    threadId?: string;
  }
): Promise<SendEmailResult> {
  try {
    const gmail = getGmailClient(accessToken);
    const raw = buildMimeMessage(
      opts.from,
      opts.fromName,
      opts.to,
      opts.subject,
      opts.htmlBody,
      opts.threadId
    );
    const encoded = Buffer.from(raw).toString('base64url');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encoded,
        ...(opts.threadId ? { threadId: opts.threadId } : {}),
      },
    });

    return {
      success: true,
      messageId: res.data.id || undefined,
      threadId: res.data.threadId || undefined,
    };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err.message };
  }
}

// ─── Récupérer l'email de l'utilisateur connecté ─────────────────────────────

export async function getUserEmail(accessToken: string): Promise<string> {
  try {
    const gmail = getGmailClient(accessToken);
    const res = await gmail.users.getProfile({ userId: 'me' });
    return res.data.emailAddress || '';
  } catch {
    return '';
  }
}

// ─── Vérifier les réponses ───────────────────────────────────────────────────

export async function checkReply(
  accessToken: string,
  threadId: string
): Promise<boolean> {
  try {
    const gmail = getGmailClient(accessToken);
    const thread = await gmail.users.threads.get({ userId: 'me', id: threadId });
    return (thread.data.messages?.length || 0) > 1;
  } catch {
    return false;
  }
}

// ─── Chercher le thread ID d'un mail envoyé ───────────────────────────────────

export async function findSentThreadId(
  accessToken: string,
  to: string,
  subject: string
): Promise<string | null> {
  try {
    await new Promise((r) => setTimeout(r, 2000)); // attendre indexation Gmail
    const gmail = getGmailClient(accessToken);
    const q = `to:${to} subject:"${subject}" in:sent`;
    const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 1 });
    if (!res.data.messages?.length) return null;
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: res.data.messages[0].id!,
    });
    return msg.data.threadId || null;
  } catch {
    return null;
  }
}
