'use client';
import { useEffect, useState } from 'react';
import type { Template, Workspace } from '@/lib/types';
import { uuidv4 } from '@/lib/utils';

export default function TemplatesPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);

  useEffect(() => {
    const el = document.getElementById('active-workspace-id');
    const spreadsheetId = el?.dataset.sheet;
    const workspaceId = el?.dataset.id;
    if (!spreadsheetId || !workspaceId) return;

    const stored: Workspace[] = JSON.parse(localStorage.getItem('ekke_workspaces') || '[]');
    const ws = stored.find((w) => w.id === workspaceId);
    if (ws) setWorkspace(ws);

    fetch(`/api/templates?spreadsheetId=${spreadsheetId}`)
      .then((r) => r.json())
      .then((data) => { if (data.ok) setTemplates(data.data); })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(template: Template) {
    const el = document.getElementById('active-workspace-id');
    const spreadsheetId = el?.dataset.sheet;
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId, template }),
    });
    const data = await res.json();
    if (data.ok) {
      setTemplates((prev) => {
        const exists = prev.find((t) => t.id === template.id);
        return exists ? prev.map((t) => t.id === template.id ? template : t) : [...prev, template];
      });
      setEditing(null);
    }
  }

  async function handleDelete(templateId: string) {
    if (!confirm('Supprimer ce template ?')) return;
    const el = document.getElementById('active-workspace-id');
    const spreadsheetId = el?.dataset.sheet;
    await fetch(`/api/templates?spreadsheetId=${spreadsheetId}&templateId=${templateId}`, { method: 'DELETE' });
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }

  function newTemplate(): Template {
    return {
      id: uuidv4(),
      nom: '',
      type: workspace?.contactTypes[0]?.id || '',
      sujet: '',
      bodyHtml: '<p>Bonjour {{prénom}},</p>\n<p></p>\n<p>Cordialement,<br>EKKE</p>',
      ordre: templates.length,
      actif: true,
      dateCreation: new Date().toISOString(),
    };
  }

  const grouped = (workspace?.contactTypes || []).reduce((acc, ct) => {
    acc[ct.id] = templates.filter((t) => t.type === ct.id);
    return acc;
  }, {} as Record<string, Template[]>);

  const ungrouped = templates.filter((t) => !workspace?.contactTypes.find((ct) => ct.id === t.type));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Templates</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {templates.length} template{templates.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setEditing(newTemplate())}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          + Nouveau template
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl py-16 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Aucun template</p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>
            Utilise {'{{NomColonne}}'} pour personnaliser avec les données de tes contacts
          </p>
          <button onClick={() => setEditing(newTemplate())}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--accent)', color: 'white' }}>
            Créer le premier template
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Templates par type */}
          {workspace?.contactTypes.map((ct) => {
            const ctTemplates = grouped[ct.id] || [];
            if (ctTemplates.length === 0) return null;
            return (
              <div key={ct.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: ct.color }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ct.label}</h3>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>({ctTemplates.length})</span>
                </div>
                <div className="grid gap-3">
                  {ctTemplates.sort((a, b) => a.ordre - b.ordre).map((t) => (
                    <TemplateCard key={t.id} template={t} color={ct.color}
                      onEdit={() => setEditing(t)}
                      onPreview={() => setPreview(t)}
                      onDelete={() => handleDelete(t.id)} />
                  ))}
                </div>
              </div>
            );
          })}
          {ungrouped.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Autres</h3>
              <div className="grid gap-3">
                {ungrouped.map((t) => (
                  <TemplateCard key={t.id} template={t} color="var(--text-secondary)"
                    onEdit={() => setEditing(t)}
                    onPreview={() => setPreview(t)}
                    onDelete={() => handleDelete(t.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Éditeur */}
      {editing && (
        <TemplateEditor
          template={editing}
          workspace={workspace}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Preview */}
      {preview && (
        <TemplatePreview template={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

function TemplateCard({ template, color, onEdit, onPreview, onDelete }: {
  template: Template; color: string;
  onEdit: () => void; onPreview: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
        {template.ordre + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{template.nom}</p>
        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{template.sujet}</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onPreview} className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}>
          Aperçu
        </button>
        <button onClick={onEdit} className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}>
          Modifier
        </button>
        <button onClick={onDelete} className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}>
          ✕
        </button>
      </div>
    </div>
  );
}

function TemplateEditor({ template, workspace, onSave, onClose }: {
  template: Template; workspace: Workspace | null;
  onSave: (t: Template) => void; onClose: () => void;
}) {
  const [t, setT] = useState(template);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(t);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-3xl max-h-[95vh] flex flex-col rounded-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t.id && template.nom ? 'Modifier le template' : 'Nouveau template'}
          </h3>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>✕</button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nom du template</label>
              <input value={t.nom} onChange={(e) => setT({ ...t, nom: e.target.value })}
                placeholder="ex: Mail initial booking"
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Type</label>
              <select value={t.type} onChange={(e) => setT({ ...t, type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}>
                {workspace?.contactTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>{ct.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Sujet du mail
              </label>
              <input value={t.sujet} onChange={(e) => setT({ ...t, sujet: e.target.value })}
                placeholder="ex: Proposition de booking — {{artiste}}"
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Ordre (0 = mail initial, 1 = relance 1…)
              </label>
              <input type="number" min={0} value={t.ordre}
                onChange={(e) => setT({ ...t, ordre: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Corps du mail (HTML)
              </label>
              <span className="text-xs px-2 py-0.5 rounded-lg"
                style={{ background: 'rgba(124,58,237,0.15)', color: 'var(--accent-light)' }}>
                {'{{NomColonne}}'} pour les variables
              </span>
            </div>
            <textarea
              value={t.bodyHtml}
              onChange={(e) => setT({ ...t, bodyHtml: e.target.value })}
              rows={14}
              spellCheck={false}
              className="w-full px-4 py-3 rounded-xl text-xs font-mono resize-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', lineHeight: '1.6' }}
            />
          </div>
        </div>
        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl"
            style={{ color: 'var(--text-secondary)' }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm rounded-xl font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}>
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplatePreview({ template, onClose }: { template: Template; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{template.nom}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Sujet : {template.sujet}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="m-4 p-6 rounded-xl" style={{ background: 'white' }}>
            <div dangerouslySetInnerHTML={{ __html: template.bodyHtml }} />
          </div>
        </div>
      </div>
    </div>
  );
}
