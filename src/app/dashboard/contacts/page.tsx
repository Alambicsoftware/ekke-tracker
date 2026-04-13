'use client';
import { useEffect, useState, useRef } from 'react';
import type { Contact, ContactType, Workspace } from '@/lib/types';
import { STATUS_CONFIG, getDisplayStatus, formatDate, truncate } from '@/lib/utils';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export default function ContactsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeType, setActiveType] = useState<ContactType | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>('');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Charger le workspace depuis le DOM
  useEffect(() => {
    const el = document.getElementById('active-workspace-id');
    const spreadsheetId = el?.dataset.sheet;
    const workspaceId = el?.dataset.id;
    if (!spreadsheetId || !workspaceId) return;

    const stored: Workspace[] = JSON.parse(localStorage.getItem('ekke_workspaces') || '[]');
    const ws = stored.find((w) => w.id === workspaceId);
    if (ws) {
      setWorkspace(ws);
      setActiveType(ws.contactTypes[0] || null);
    }
  }, []);

  useEffect(() => {
    if (!activeType || !workspace) return;
    loadContacts(workspace.spreadsheetId, activeType.tabName);
  }, [activeType, workspace]);

  async function loadContacts(spreadsheetId: string, tabName: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts?spreadsheetId=${spreadsheetId}&tabName=${encodeURIComponent(tabName)}`);
      const data = await res.json();
      if (data.ok) {
        setHeaders(data.data.userHeaders);
        setContacts(data.data.contacts);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleRelance(contact: Contact) {
    if (!workspace || !activeType) return;
    const newVal = !contact._relance_active;
    await fetch('/api/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spreadsheetId: workspace.spreadsheetId,
        tabName: activeType.tabName,
        rowIndex: contact.rowIndex,
        updates: { _relance_active: newVal },
      }),
    });
    setContacts((prev) =>
      prev.map((c) => c.rowIndex === contact.rowIndex ? { ...c, _relance_active: newVal } : c)
    );
  }

  async function handleSaveComment(contact: Contact, comment: string) {
    if (!workspace || !activeType) return;
    await fetch('/api/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spreadsheetId: workspace.spreadsheetId,
        tabName: activeType.tabName,
        rowIndex: contact.rowIndex,
        updates: { _commentaire: comment },
      }),
    });
    setContacts((prev) =>
      prev.map((c) => c.rowIndex === contact.rowIndex ? { ...c, _commentaire: comment } : c)
    );
    setEditingContact(null);
  }

  // Import fichier
  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !workspace || !activeType) return;

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          await importRows(results.data);
        },
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        await importRows(rows);
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const rows = JSON.parse(ev.target?.result as string);
          if (Array.isArray(rows)) await importRows(rows);
        } catch { setImportResult('Fichier JSON invalide'); }
      };
      reader.readAsText(file);
    }

    // Reset input
    if (fileRef.current) fileRef.current.value = '';
  }

  async function importRows(rows: Record<string, string>[]) {
    if (!workspace || !activeType) return;
    setImporting(true);
    setImportResult('');
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: workspace.spreadsheetId,
          tabName: activeType.tabName,
          rows,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setImportResult(`✓ ${data.data.imported} contacts importés`);
        await loadContacts(workspace.spreadsheetId, activeType.tabName);
      } else {
        setImportResult(`Erreur: ${data.error}`);
      }
    } finally {
      setImporting(false);
    }
  }

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.email.toLowerCase().includes(s) ||
      Object.values(c.data).some((v) => v.toLowerCase().includes(s))
    );
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Contacts</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {contacts.length} contacts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="px-4 py-2 rounded-xl text-sm w-48"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {importing ? '…' : '↑ Importer'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            className="hidden"
            onChange={handleFileImport}
          />
        </div>
      </div>

      {importResult && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{
            background: importResult.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(248,113,113,0.1)',
            color: importResult.startsWith('✓') ? '#10b981' : '#f87171',
            border: `1px solid ${importResult.startsWith('✓') ? 'rgba(16,185,129,0.3)' : 'rgba(248,113,113,0.3)'}`,
          }}
        >
          {importResult}
        </div>
      )}

      {/* Onglets types */}
      {workspace && (
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {workspace.contactTypes.map((ct) => (
            <button
              key={ct.id}
              onClick={() => setActiveType(ct)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0"
              style={{
                background: activeType?.id === ct.id ? ct.color + '33' : 'var(--card)',
                color: activeType?.id === ct.id ? ct.color : 'var(--text-secondary)',
                border: `1px solid ${activeType?.id === ct.id ? ct.color + '66' : 'var(--border)'}`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: ct.color }}
              />
              {ct.label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {search ? 'Aucun résultat' : 'Aucun contact — importe un fichier CSV/Excel/JSON'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Email</th>
                  {headers.filter((h) => h !== 'email').slice(0, 3).map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {h}
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Statut</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Dernier envoi</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Envois</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact) => {
                  const displayStatus = getDisplayStatus(contact._statut, contact._relance_active);
                  const statusConf = STATUS_CONFIG[displayStatus];
                  return (
                    <tr
                      key={contact.rowIndex}
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                        {contact.email}
                      </td>
                      {headers.filter((h) => h !== 'email').slice(0, 3).map((h) => (
                        <td key={h} className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                          {truncate(contact.data[h] || '', 30)}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: statusConf.bg, color: statusConf.color }}
                        >
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatDate(contact._date_envoi)}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {contact._nb_envois}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* Toggle relance */}
                          <button
                            onClick={() => handleToggleRelance(contact)}
                            title={contact._relance_active ? 'Bloquer les relances' : 'Autoriser les relances'}
                            className="w-7 h-4 rounded-full relative transition-colors"
                            style={{
                              background: contact._relance_active ? 'var(--accent)' : 'var(--border)',
                            }}
                          >
                            <span
                              className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                              style={{ transform: contact._relance_active ? 'translateX(14px)' : 'translateX(2px)' }}
                            />
                          </button>
                          {/* Commentaire */}
                          <button
                            onClick={() => setEditingContact(contact)}
                            className="text-xs px-2 py-0.5 rounded-lg"
                            style={{
                              background: contact._commentaire ? 'rgba(245,158,11,0.15)' : 'var(--surface)',
                              color: contact._commentaire ? '#f59e0b' : 'var(--text-secondary)',
                              border: '1px solid ' + (contact._commentaire ? 'rgba(245,158,11,0.3)' : 'var(--border)'),
                            }}
                            title={contact._commentaire || 'Ajouter un commentaire'}
                          >
                            {contact._commentaire ? '💬' : '+ note'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal commentaire */}
      {editingContact && (
        <CommentModal
          contact={editingContact}
          onSave={(comment) => handleSaveComment(editingContact, comment)}
          onClose={() => setEditingContact(null)}
        />
      )}
    </div>
  );
}

function CommentModal({ contact, onSave, onClose }: {
  contact: Contact;
  onSave: (comment: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(contact._commentaire || '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm p-6 rounded-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Commentaire</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{contact.email}</p>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          placeholder="Ajoute une note sur ce contact…"
          className="w-full px-4 py-3 rounded-xl text-sm resize-none"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl"
            style={{ color: 'var(--text-secondary)' }}>Annuler</button>
          <button
            onClick={() => onSave(value)}
            className="px-4 py-2 text-sm rounded-xl font-medium"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
