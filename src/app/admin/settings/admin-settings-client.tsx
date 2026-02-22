'use client';

import { useState, useEffect } from 'react';

interface Preset {
  grid_size: number;
  min_density: number;
  max_density: number;
  min_span: number;
  max_candidates: number;
  pattern_attempts: number;
  max_attempts: number;
}

const FIELDS: { key: keyof Omit<Preset, 'grid_size'>; label: string; hint: string; step: string; min: number }[] = [
  { key: 'min_density', label: 'Min Density', hint: 'Floor for black cell ratio. Lower = more open grids with longer words. Default 0.18 (18%).', step: '0.01', min: 0 },
  { key: 'max_density', label: 'Max Density', hint: 'Ceiling for black cell ratio. Higher = allows denser grids with more word boundaries. Default 0.28 (28%).', step: '0.01', min: 0 },
  { key: 'min_span', label: 'Min Span', hint: 'Shortest allowed word length. Every white cell must belong to a run this long in both directions. Default 3.', step: '1', min: 2 },
  { key: 'max_candidates', label: 'Max Candidates', hint: 'Words the backtracker tries per slot. Higher = better fill quality but slower. Lower = faster but more failures. Default 50.', step: '1', min: 1 },
  { key: 'pattern_attempts', label: 'Pattern Attempts', hint: 'How many grid layouts to try per generation cycle before giving up. Default 20.', step: '1', min: 1 },
  { key: 'max_attempts', label: 'Max Attempts', hint: 'Total generation cycles (pattern + fill) before reporting failure to the user. Default 50.', step: '1', min: 1 },
];

export function AdminSettingsClient() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/presets')
      .then(res => res.json())
      .then((data: Preset[]) => {
        setPresets(data.sort((a, b) => a.grid_size - b.grid_size));
        setLoading(false);
      })
      .catch(() => {
        setMessage({ type: 'error', text: 'Failed to load presets' });
        setLoading(false);
      });
  }, []);

  const handleChange = (gridSize: number, key: keyof Preset, value: string) => {
    setPresets(prev =>
      prev.map(p =>
        p.grid_size === gridSize ? { ...p, [key]: parseFloat(value) || 0 } : p
      )
    );
  };

  const handleSave = async (preset: Preset) => {
    setSaving(preset.grid_size);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset),
      });
      if (!res.ok) throw new Error('Save failed');
      setMessage({ type: 'success', text: `Saved ${preset.grid_size}\u00d7${preset.grid_size} preset` });
    } catch {
      setMessage({ type: 'error', text: `Failed to save ${preset.grid_size}\u00d7${preset.grid_size} preset` });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="status info">Loading presets...</div>;

  return (
    <div style={{ marginTop: 24 }}>
      {message && (
        <div className={`status ${message.type}`}>{message.text}</div>
      )}

      {presets.map(preset => (
        <div key={preset.grid_size} className="card" style={{ marginTop: 16 }}>
          <h2>{preset.grid_size}&times;{preset.grid_size}</h2>
          <div style={{ marginTop: 16 }}>
            {FIELDS.map(({ key, label, hint, step, min }) => (
              <div key={key} className="settings-row">
                <div>
                  <div className="setting-label">{label}</div>
                  <div className="setting-hint">{hint}</div>
                </div>
                <div className="setting-input">
                  <input
                    type="number"
                    step={step}
                    min={min}
                    value={preset[key]}
                    onChange={e => handleChange(preset.grid_size, key, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ccc',
                      borderRadius: 4,
                      fontSize: '0.9rem',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary"
              onClick={() => handleSave(preset)}
              disabled={saving === preset.grid_size}
            >
              {saving === preset.grid_size ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
