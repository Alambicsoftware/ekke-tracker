import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import type { Contact, Template, Campaign, TrackingEvent, Workspace } from './types';

// ─── Auth Service Account ────────────────────────────────────────────────────

function getServiceAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getServiceAuth() });
}

// ─── Colonnes système ─────────────────────────────────────────────────────────

export const SYSTEM_COLS = [
  '_statut', '_nb_envois', '_date_envoi', '_thread_id',
  '_contact_id', '_date_ouverture', '_date_clic', '_url_clic',
  '_commentaire', '_relance_active',
];

// Noms d'onglets réservés
export const SYSTEM_TABS = ['_Config', '_Templates', '_Campagnes', '_Tracking'];

// ─── Utilitaires ─────────────────────────────────────────────────────────────

async function getRange(spreadsheetId: string, range: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values as string[][]) || [];
}

async function setRange(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean)[][]
) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

async function appendRange(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean)[][]
) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

// Colonnes → lettre (0=A, 1=B, …, 25=Z, 26=AA, …)
function colLetter(n: number): string {
  let s = '';
  n++;
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

// ─── Initialisation workspace ─────────────────────────────────────────────────

export async function initWorkspaceSheet(
  spreadsheetId: string,
  workspace: Omit<Workspace, 'spreadsheetId' | 'createdAt'>
) {
  const sheets = getSheetsClient();

  // Récupérer les onglets existants
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = (meta.data.sheets || []).map((s) => s.properties?.title || '');

  const tabsToCreate: string[] = [];

  // Onglets système
  for (const tab of SYSTEM_TABS) {
    if (!existingTabs.includes(tab)) tabsToCreate.push(tab);
  }

  // Onglets contacts
  for (const ct of workspace.contactTypes) {
    if (!existingTabs.includes(ct.tabName)) tabsToCreate.push(ct.tabName);
  }

  // Créer les onglets manquants
  if (tabsToCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: tabsToCreate.map((title) => ({
          addSheet: { properties: { title } },
        })),
      },
    });
  }

  // Initialiser _Config
  await setRange(spreadsheetId, '_Config!A1:B1', [['Clé', 'Valeur']]);
  await setRange(spreadsheetId, '_Config!A2:B6', [
    ['workspace_name', workspace.name],
    ['contact_types', JSON.stringify(workspace.contactTypes)],
    ['delays', JSON.stringify(workspace.delays)],
    ['stop_statuses', JSON.stringify(workspace.stopStatuses)],
    ['owner_email', ''],
  ]);

  // Initialiser les en-têtes _Templates
  await setRange(spreadsheetId, '_Templates!A1:G1', [[
    'id', 'nom', 'type', 'sujet', 'body_html', 'ordre', 'actif',
  ]]);

  // Initialiser les en-têtes _Campagnes
  await setRange(spreadsheetId, '_Campagnes!A1:J1', [[
    'id', 'nom', 'type', 'contact_type', 'tab_name',
    'template_ids', 'delays', 'statut', 'date_creation', 'notes',
  ]]);

  // Initialiser les en-têtes _Tracking
  await setRange(spreadsheetId, '_Tracking!A1:N1', [[
    'id', 'contact_id', 'campaign_id', 'user_email', 'workspace_id',
    'spreadsheet_id', 'tab_name', 'row_index', 'contact_email',
    'sent_at', 'opened_at', 'clicked_at', 'clicked_url', 'nb_envois',
  ]]);

  // Initialiser les en-têtes des onglets contacts
  for (const ct of workspace.contactTypes) {
    if (!existingTabs.includes(ct.tabName)) {
      const headers = ['email', 'prénom', 'nom', ...SYSTEM_COLS];
      await setRange(
        spreadsheetId,
        `${ct.tabName}!A1:${colLetter(headers.length - 1)}1`,
        [headers]
      );
    }
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getWorkspaceConfig(spreadsheetId: string): Promise<Partial<Workspace>> {
  const rows = await getRange(spreadsheetId, '_Config!A:B');
  const config: Record<string, string> = {};
  for (const row of rows.slice(1)) {
    if (row[0]) config[row[0]] = row[1] || '';
  }
  return {
    name: config.workspace_name,
    contactTypes: config.contact_types ? JSON.parse(config.contact_types) : [],
    delays: config.delays ? JSON.parse(config.delays) : [0, 14, 30],
    stopStatuses: config.stop_statuses
      ? JSON.parse(config.stop_statuses)
      : ['REPLIED', 'UNSUBSCRIBED', 'BOUNCE'],
  };
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function getContacts(
  spreadsheetId: string,
  tabName: string
): Promise<{ headers: string[]; userHeaders: string[]; contacts: Contact[] }> {
  const rows = await getRange(spreadsheetId, `${tabName}!A:ZZ`);
  if (rows.length === 0) return { headers: [], userHeaders: [], contacts: [] };

  const headers = rows[0].map((h) => h.toString());
  const userHeaders = headers.filter((h) => !h.startsWith('_'));

  const contacts: Contact[] = rows.slice(1).map((row, idx) => {
    const get = (col: string) => {
      const i = headers.indexOf(col);
      return i >= 0 ? (row[i] || '') : '';
    };
    const data: Record<string, string> = {};
    for (const h of userHeaders) {
      const i = headers.indexOf(h);
      data[h] = i >= 0 ? (row[i] || '') : '';
    }
    return {
      rowIndex: idx + 2, // ligne dans le sheet (header = ligne 1)
      email: get('email'),
      data,
      _statut: get('_statut'),
      _nb_envois: parseInt(get('_nb_envois') || '0', 10),
      _date_envoi: get('_date_envoi'),
      _thread_id: get('_thread_id'),
      _contact_id: get('_contact_id'),
      _date_ouverture: get('_date_ouverture'),
      _date_clic: get('_date_clic'),
      _url_clic: get('_url_clic'),
      _commentaire: get('_commentaire'),
      _relance_active: get('_relance_active') !== 'FALSE',
    };
  }).filter((c) => c.email);

  return { headers, userHeaders, contacts };
}

export async function updateContactSystemCols(
  spreadsheetId: string,
  tabName: string,
  rowIndex: number,
  updates: Partial<{
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
  }>
) {
  // Lire les headers pour trouver les indices des colonnes
  const headerRow = await getRange(spreadsheetId, `${tabName}!1:1`);
  const headers = (headerRow[0] || []).map((h) => h.toString());

  for (const [key, value] of Object.entries(updates)) {
    const colIdx = headers.indexOf(key);
    if (colIdx < 0) continue;
    const cellRef = `${tabName}!${colLetter(colIdx)}${rowIndex}`;
    await setRange(spreadsheetId, cellRef, [[value as string | number | boolean]]);
  }
}

export async function importContactsToSheet(
  spreadsheetId: string,
  tabName: string,
  rows: Record<string, string>[]
) {
  if (rows.length === 0) return;

  // Lire les headers existants
  const headerRow = await getRange(spreadsheetId, `${tabName}!1:1`);
  let headers = (headerRow[0] || []).map((h) => h.toString());

  // Identifier les nouvelles colonnes user (sans _)
  const allKeys = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!k.startsWith('_')) allKeys.add(k);
    }
  }

  // S'assurer que les colonnes system sont à la fin
  const userKeys = [...allKeys].filter((k) => !headers.includes(k));
  if (userKeys.length > 0) {
    // Insérer les nouvelles colonnes user avant les colonnes système
    const sysStart = headers.findIndex((h) => h.startsWith('_'));
    if (sysStart >= 0) {
      headers = [
        ...headers.slice(0, sysStart),
        ...userKeys,
        ...headers.slice(sysStart),
      ];
    } else {
      headers = [...headers, ...userKeys, ...SYSTEM_COLS];
    }
    await setRange(
      spreadsheetId,
      `${tabName}!A1:${colLetter(headers.length - 1)}1`,
      [headers]
    );
  }

  // Préparer les lignes à ajouter
  const valuesToAppend = rows.map((row) =>
    headers.map((h) => {
      if (h.startsWith('_')) {
        if (h === '_relance_active') return 'TRUE';
        if (h === '_nb_envois') return '0';
        return '';
      }
      return row[h] || '';
    })
  );

  await appendRange(spreadsheetId, `${tabName}!A:A`, valuesToAppend);
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates(spreadsheetId: string): Promise<Template[]> {
  const rows = await getRange(spreadsheetId, '_Templates!A:G');
  if (rows.length <= 1) return [];
  return rows.slice(1).map((row) => ({
    id: row[0] || '',
    nom: row[1] || '',
    type: row[2] || '',
    sujet: row[3] || '',
    bodyHtml: row[4] || '',
    ordre: parseInt(row[5] || '0', 10),
    actif: row[6] !== 'FALSE',
    dateCreation: '',
  })).filter((t) => t.id);
}

export async function saveTemplate(spreadsheetId: string, template: Template) {
  const rows = await getRange(spreadsheetId, '_Templates!A:A');
  const existing = rows.findIndex((r) => r[0] === template.id);

  const values = [[
    template.id || uuidv4(),
    template.nom,
    template.type,
    template.sujet,
    template.bodyHtml,
    template.ordre.toString(),
    template.actif ? 'TRUE' : 'FALSE',
  ]];

  if (existing > 0) {
    await setRange(spreadsheetId, `_Templates!A${existing + 1}:G${existing + 1}`, values);
  } else {
    await appendRange(spreadsheetId, '_Templates!A:A', values);
  }
}

export async function deleteTemplate(spreadsheetId: string, templateId: string) {
  const rows = await getRange(spreadsheetId, '_Templates!A:A');
  const rowIdx = rows.findIndex((r) => r[0] === templateId);
  if (rowIdx > 0) {
    // Effacer la ligne (on ne supprime pas pour garder les indices)
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `_Templates!A${rowIdx + 1}:G${rowIdx + 1}`,
    });
  }
}

// ─── Campagnes ───────────────────────────────────────────────────────────────

export async function getCampaigns(spreadsheetId: string): Promise<Campaign[]> {
  const rows = await getRange(spreadsheetId, '_Campagnes!A:J');
  if (rows.length <= 1) return [];
  return rows.slice(1).map((row) => ({
    id: row[0] || '',
    nom: row[1] || '',
    type: row[2] || '',
    contactType: row[3] || '',
    tabName: row[4] || '',
    templateIds: row[5] ? JSON.parse(row[5]) : [],
    delays: row[6] ? JSON.parse(row[6]) : [0, 14, 30],
    statut: (row[7] as Campaign['statut']) || 'draft',
    dateCreation: row[8] || '',
    dateDerniereAction: '',
    notes: row[9] || '',
  })).filter((c) => c.id);
}

export async function saveCampaign(spreadsheetId: string, campaign: Campaign) {
  const rows = await getRange(spreadsheetId, '_Campagnes!A:A');
  const existing = rows.findIndex((r) => r[0] === campaign.id);

  const values = [[
    campaign.id || uuidv4(),
    campaign.nom,
    campaign.type,
    campaign.contactType,
    campaign.tabName,
    JSON.stringify(campaign.templateIds),
    JSON.stringify(campaign.delays),
    campaign.statut,
    campaign.dateCreation || new Date().toISOString(),
    campaign.notes || '',
  ]];

  if (existing > 0) {
    await setRange(spreadsheetId, `_Campagnes!A${existing + 1}:J${existing + 1}`, values);
  } else {
    await appendRange(spreadsheetId, '_Campagnes!A:A', values);
  }
}

// ─── Tracking ────────────────────────────────────────────────────────────────

export async function addTrackingEvent(event: TrackingEvent) {
  const spreadsheetId = process.env.TRACKER_SHEET_ID!;
  await appendRange(spreadsheetId, '_Tracking!A:A', [[
    event.id,
    event.contactId,
    event.campaignId,
    event.userEmail,
    event.workspaceId,
    event.spreadsheetId,
    event.tabName,
    event.rowIndex,
    event.contactEmail,
    event.sentAt,
    '',   // opened_at
    '',   // clicked_at
    '',   // clicked_url
    event.nbEnvois,
  ]]);
}

export async function updateTrackingOpen(contactId: string) {
  const spreadsheetId = process.env.TRACKER_SHEET_ID!;
  const rows = await getRange(spreadsheetId, '_Tracking!A:N');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === contactId && !rows[i][10]) {
      await setRange(
        spreadsheetId,
        `_Tracking!K${i + 1}`,
        [[new Date().toISOString()]]
      );
      return true;
    }
  }
  return false;
}

export async function updateTrackingClick(contactId: string, url: string) {
  const spreadsheetId = process.env.TRACKER_SHEET_ID!;
  const rows = await getRange(spreadsheetId, '_Tracking!A:N');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === contactId) {
      await setRange(
        spreadsheetId,
        `_Tracking!L${i + 1}:M${i + 1}`,
        [[new Date().toISOString(), url]]
      );
      return true;
    }
  }
  return false;
}

export async function getTrackingForWorkspace(
  workspaceId: string
): Promise<TrackingEvent[]> {
  const spreadsheetId = process.env.TRACKER_SHEET_ID!;
  const rows = await getRange(spreadsheetId, '_Tracking!A:N');
  if (rows.length <= 1) return [];

  return rows.slice(1)
    .filter((r) => r[4] === workspaceId)
    .map((r) => ({
      id: r[0] || '',
      contactId: r[1] || '',
      campaignId: r[2] || '',
      userEmail: r[3] || '',
      workspaceId: r[4] || '',
      spreadsheetId: r[5] || '',
      tabName: r[6] || '',
      rowIndex: parseInt(r[7] || '0', 10),
      contactEmail: r[8] || '',
      sentAt: r[9] || '',
      openedAt: r[10] || '',
      clickedAt: r[11] || '',
      clickedUrl: r[12] || '',
      nbEnvois: parseInt(r[13] || '0', 10),
    }));
}

export async function getTrackingForCampaign(campaignId: string): Promise<TrackingEvent[]> {
  const spreadsheetId = process.env.TRACKER_SHEET_ID!;
  const rows = await getRange(spreadsheetId, '_Tracking!A:N');
  if (rows.length <= 1) return [];

  return rows.slice(1)
    .filter((r) => r[2] === campaignId)
    .map((r) => ({
      id: r[0] || '',
      contactId: r[1] || '',
      campaignId: r[2] || '',
      userEmail: r[3] || '',
      workspaceId: r[4] || '',
      spreadsheetId: r[5] || '',
      tabName: r[6] || '',
      rowIndex: parseInt(r[7] || '0', 10),
      contactEmail: r[8] || '',
      sentAt: r[9] || '',
      openedAt: r[10] || '',
      clickedAt: r[11] || '',
      clickedUrl: r[12] || '',
      nbEnvois: parseInt(r[13] || '0', 10),
    }));
}

// ─── Electron App Tracking ────────────────────────────────────────────────────
// Separate tab (_Electron) keyed by tracking_id UUID generated by the desktop app.
// Columns: tracking_id | opened_at | clicked_at | clicked_url

const ELECTRON_TAB = '_Electron';

async function ensureElectronTab(spreadsheetId: string): Promise<void> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets || []).some(
    (s) => s.properties?.title === ELECTRON_TAB
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: ELECTRON_TAB } } }],
      },
    });
    await setRange(spreadsheetId, `${ELECTRON_TAB}!A1:E1`, [
      ['tracking_id', 'opened_at', 'clicked_at', 'clicked_url', 'unsubscribed_at'],
    ]);
  }
}

export async function recordElectronOpen(trackingId: string): Promise<void> {
  const spreadsheetId = process.env.TRACKER_SHEET_ID!;
  await ensureElectronTab(spreadsheetId);
  const rows = await getRange(spreadsheetId, `${ELECTRON_TAB}!A:D`);
  const idx = rows.slice(1).findIndex((r) => r[0] === trackingId);
  if (idx >= 0) {
    // Row exists — update opened_at only if not already set
    if (!rows[idx + 1][1]) {
      await setRange(
        spreadsheetId,
        `${ELECTRON_TAB}!B${idx + 2}`,
        [[new Date().toISOString()]]
      );
    }
  } else {
    await appendRange(spreadsheetId, `${ELECTRON_TAB}!A:D`, [
      [trackingId, new Date().toISOString(), '', ''],
    ]);
  }
}

export async function recordElectronClick(trackingId: string, url: string): Promise<void> {
  const spreadsheetId = process.env.TRACKER_SHEET_ID!;
  await ensureElectronTab(spreadsheetId);
  const rows = await getRange(spreadsheetId, `${ELECTRON_TAB}!A:D`);
  const idx = rows.slice(1).findIndex((r) => r[0] === trackingId);
  if (idx >= 0) {
    // Row exists — update clicked_at/url only if not already set
    if (!rows[idx + 1][2]) {
      await setRange(
        spreadsheetId,
        `${ELECTRON_TAB}!C${idx + 2}:D${idx + 2}`,
        [[new Date().toISOString(), url]]
      );
    }
  } else {
    await appendRange(spreadsheetId, `${ELECTRON_TAB}!A:D`, [
      [trackingId, '', new Date().toISOString(), url],
    ]);
  }
}

export async function recordElectronUnsubscribe(trackingId: string): Promise<void> {
  const spreadsheetId = process.env.TRACKER_SHEET_ID!;
  await ensureElectronTab(spreadsheetId);
  const rows = await getRange(spreadsheetId, `${ELECTRON_TAB}!A:E`);
  const idx = rows.slice(1).findIndex((r) => r[0] === trackingId);
  if (idx >= 0) {
    if (!rows[idx + 1][4]) {
      await setRange(
        spreadsheetId,
        `${ELECTRON_TAB}!E${idx + 2}`,
        [[new Date().toISOString()]]
      );
    }
  } else {
    await appendRange(spreadsheetId, `${ELECTRON_TAB}!A:E`, [
      [trackingId, '', '', '', new Date().toISOString()],
    ]);
  }
}

export async function getElectronEvents(
  trackingIds: string[]
): Promise<Record<string, { opened_at: string; clicked_at: string; clicked_url: string; unsubscribed_at: string }>> {
  const spreadsheetId = process.env.TRACKER_SHEET_ID!;
  const rows = await getRange(spreadsheetId, `${ELECTRON_TAB}!A:E`).catch(
    () => [] as string[][]
  );
  const result: Record<string, { opened_at: string; clicked_at: string; clicked_url: string; unsubscribed_at: string }> = {};
  for (const row of rows.slice(1)) {
    if (row[0] && trackingIds.includes(row[0])) {
      result[row[0]] = {
        opened_at:       row[1] || '',
        clicked_at:      row[2] || '',
        clicked_url:     row[3] || '',
        unsubscribed_at: row[4] || '',
      };
    }
  }
  return result;
}
