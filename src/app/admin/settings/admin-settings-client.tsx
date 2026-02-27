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

interface Field {
  key: keyof Omit<Preset, 'grid_size'>;
  label: string;
  hint: string;
  step: string;
  min: number;
}

interface FieldSection {
  title: string;
  note: string;
  fields: Field[];
}

const SECTIONS: FieldSection[] = [
  {
    title: 'Grid Shape',
    note: 'Min and Max Density define the acceptable range for the black-cell ratio. The pattern generator places symmetric black-cell pairs until density lands inside this window. A narrower range produces more consistent-looking grids but causes more pattern failures — widen it if generation is slow. Min Span is enforced independently: every white cell must sit in a run at least this long in both directions, regardless of density.',
    fields: [
      { key: 'min_density', label: 'Min Density', hint: 'Floor for black-cell ratio. Lower = more open grids with longer words. Default 0.18 (18%).', step: '0.01', min: 0 },
      { key: 'max_density', label: 'Max Density', hint: 'Ceiling for black-cell ratio. Higher = denser grids with more short words. Default 0.28 (28%).', step: '0.01', min: 0 },
      { key: 'min_span', label: 'Min Span', hint: 'Shortest allowed word length. Every white cell must belong to a horizontal and vertical run at least this long. Default 3.', step: '1', min: 2 },
    ],
  },
  {
    title: 'Word Fill',
    note: 'Once a valid pattern is found, the filler places words using backtracking with an MRV (fewest-options-first) heuristic. Max Candidates caps how many words it tries per slot — higher values improve fill quality but slow things down exponentially.',
    fields: [
      { key: 'max_candidates', label: 'Max Candidates', hint: 'Words the backtracker considers per slot. Higher = better fills but slower. Lower = faster but more dead ends. Default 50.', step: '1', min: 1 },
    ],
  },
  {
    title: 'Retry Budget',
    note: 'Generation is a two-phase loop: generate a pattern, then try to fill it. If fill fails, a new pattern is generated. Pattern Attempts controls the inner loop (how many layouts to try before giving up on a pattern). Max Attempts controls the outer loop (how many pattern+fill cycles to run before showing an error). Worst-case total pattern tries = Pattern Attempts \u00d7 Max Attempts.',
    fields: [
      { key: 'pattern_attempts', label: 'Pattern Attempts', hint: 'Grid layouts to try per cycle before giving up on the pattern. Default 20.', step: '1', min: 1 },
      { key: 'max_attempts', label: 'Max Attempts', hint: 'Total pattern+fill cycles before reporting failure. Default 50.', step: '1', min: 1 },
    ],
  },
];

export function AdminSettingsClient() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/presets', { cache: 'no-store' })
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

      // Re-fetch to confirm persistence and sync local state with DB
      const freshRes = await fetch('/api/presets', { cache: 'no-store' });
      if (freshRes.ok) {
        const freshData: Preset[] = await freshRes.json();
        setPresets(freshData.sort((a, b) => a.grid_size - b.grid_size));
      }

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
      <div className="setting-hint" style={{ fontSize: '0.8rem', lineHeight: 1.6, marginBottom: 8 }}>
        The generator runs a two-phase pipeline: first it builds a <strong>pattern</strong> (symmetric
        black-cell layout satisfying density and span constraints), then it <strong>fills</strong> the
        white cells with words via backtracking. If the fill deadlocks, it discards the pattern and
        retries. The settings below control each phase.
      </div>

      {message && (
        <div className={`status ${message.type}`}>{message.text}</div>
      )}

      {presets.map(preset => (
        <div key={preset.grid_size} className="card" style={{ marginTop: 16 }}>
          <h2>{preset.grid_size}&times;{preset.grid_size}</h2>

          {SECTIONS.map(section => (
            <div key={section.title} style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
                {section.title}
              </h3>
              <div className="setting-hint" style={{ marginBottom: 4 }}>
                {section.note}
              </div>

              {section.fields.map(({ key, label, hint, step, min }) => (
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
          ))}

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
