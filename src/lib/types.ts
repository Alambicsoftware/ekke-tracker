// ─── Workspace ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  spreadsheetId: string;
  contactTypes: ContactType[];
  delays: number[];       // délais en jours entre chaque envoi [0, 14, 30]
  stopStatuses: string[]; // statuts qui bloquent les relances
  createdAt: string;
}

export interface ContactType {
  id: string;    // ex: "booking_concert"
  label: string; // ex: "Booking Concert"
  tabName: string; // nom de l'onglet dans le sheet ex: "Contacts - Booking Concert"
  color: string; // couleur pour l'UI
}

// ─── Contact ──────────────────────────────────────────────────────────────────

export interface Contact {
  rowIndex: number;
  email: string;
  data: Record<string, string>; // toutes les colonnes user
  // Colonnes système
  _statut: string;
  _nb_envois: number;
  _date_envoi: string;
  _thread_id: string;
  _contact_id: string;
  _date_ouverture: string;
  _date_clic: string;
  _url_clic: string;
  _commentaire: string;
  _relance_active: boolean;
}

export interface ContactsTab {
  typeId: string;
  label: string;
  tabName: string;
  headers: string[]; // colonnes user uniquement (sans les colonnes _)
  contacts: Contact[];
}

// ─── Template ────────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  nom: string;
  type: string;     // type de campagne associé
  sujet: string;
  bodyHtml: string;
  ordre: number;    // ordre dans la séquence de relances (0 = premier mail)
  actif: boolean;
  dateCreation: string;
}

// ─── Campagne ────────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface Campaign {
  id: string;
  nom: string;
  type: string;        // ex: "booking_concert"
  contactType: string; // ID du type de contact
  tabName: string;     // onglet du sheet
  templateIds: string[]; // IDs des templates dans l'ordre
  delays: number[];
  statut: CampaignStatus;
  dateCreation: string;
  dateDerniereAction: string;
  notes: string;
  // Stats calculées
  totalContacts?: number;
  sent?: number;
  opened?: number;
  clicked?: number;
  replied?: number;
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

export interface TrackingEvent {
  id: string;
  contactId: string;
  campaignId: string;
  userEmail: string;
  workspaceId: string;
  spreadsheetId: string;
  tabName: string;
  rowIndex: number;
  contactEmail: string;
  sentAt: string;
  openedAt: string;
  clickedAt: string;
  clickedUrl: string;
  nbEnvois: number;
}

// ─── Send ────────────────────────────────────────────────────────────────────

export interface SendJob {
  campaignId: string;
  workspaceId: string;
  spreadsheetId: string;
  tabName: string;
  contactRows: number[]; // rowIndex des contacts à envoyer
  templateId: string;
  fromName: string;
}

export interface SendResult {
  email: string;
  success: boolean;
  error?: string;
  contactId?: string;
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ─── NextAuth ────────────────────────────────────────────────────────────────

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    workspaces?: Workspace[];
    activeWorkspaceId?: string;
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    workspaces?: Workspace[];
    activeWorkspaceId?: string;
    error?: string;
  }
}
