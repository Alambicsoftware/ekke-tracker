import { v4 as uuidv4 } from 'uuid';

export { uuidv4 };

/** Formate une date ISO en français */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Formate une date+heure en français */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Extrait l'ID d'un Google Sheet depuis une URL ou retourne la valeur si c'est déjà un ID */
export function extractSheetId(input: string): string | null {
  const trimmed = input.trim();
  // URL format: https://docs.google.com/spreadsheets/d/SHEET_ID/...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Si c'est déjà un ID (alphanum + - _)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/** Vérifie si un email est valide */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Calcule le statut à afficher */
export type DisplayStatus =
  | 'pending'
  | 'sent'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounce'
  | 'unsubscribed'
  | 'blocked';

export function getDisplayStatus(statut: string, relanceActive: boolean): DisplayStatus {
  if (!relanceActive) return 'blocked';
  const s = statut.toUpperCase();
  if (s === 'REPLIED') return 'replied';
  if (s === 'BOUNCE') return 'bounce';
  if (s === 'UNSUBSCRIBED') return 'unsubscribed';
  if (s.includes('CLICKED') || s.includes('LINK')) return 'clicked';
  if (s === 'EMAIL_OPENED') return 'opened';
  if (s.startsWith('RELANCE') || s === 'EMAIL_SENT') return 'sent';
  return 'pending';
}

export const STATUS_CONFIG: Record<DisplayStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#7878a0', bg: 'rgba(120,120,160,0.15)' },
  sent: { label: 'Envoyé', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  opened: { label: 'Ouvert', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  clicked: { label: 'Cliqué', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  replied: { label: 'Répondu', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  bounce: { label: 'Bounce', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  unsubscribed: { label: 'Désabonné', color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
  blocked: { label: 'Bloqué', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
};

/** Calcule les jours depuis une date */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/** Tronque un texte */
export function truncate(s: string, max = 50): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/** Couleurs pour les types de contacts */
export const TYPE_COLORS = [
  '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4',
];
