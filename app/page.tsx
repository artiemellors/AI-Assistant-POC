'use client';

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import OutfitResults, { type Outfit } from '@/components/OutfitResults';

// ─── Typewriter examples ────────────────────────────────────────────────

const EXAMPLES_NEUTRAL = [
  'smart casual look for a job interview',
  'relaxed weekend outfit',
  'date night in the city',
  'beach holiday vibes',
  'cosy autumn layers',
  'Sunday farmers market stroll',
  'casual brunch with friends',
  'athleisure that works for the gym and coffee',
];

const EXAMPLES_MEN = [
  "men's smart casual for an office job",
  'casual weekend look for a guy',
  "men's first date outfit",
  'relaxed beach day for blokes',
  'men\'s winter layers on a budget',
  'gym-to-brunch athleisure for men',
];

const EXAMPLES_WOMEN = [
  "women's summer garden party look",
  'chic work-from-home outfit for women',
  "women's casual beach day",
  'feminine date night style',
  "women's cosy autumn layers",
  'smart casual office look for women',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Loading copy by phase ──────────────────────────────────────────────

const THINKING_COPY = [
  'Studying your vibe...',
  'Consulting the style oracle...',
  'Interpreting your brief...',
  'Reading the fashion room...',
];

const SEARCHING_COPY = [
  'Hunting through the racks...',
  'Browsing the Kmart floor...',
  'Combing the catalogue...',
  'Finding your pieces...',
];

const CURATING_COPY = [
  'Putting your looks together...',
  'Styling your options...',
  'Making it work...',
  'Assembling the outfits...',
];

// ─── Skeleton card ──────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--color-card)',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="skeleton" style={{ aspectRatio: '4/5' }} />
      <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div className="skeleton" style={{ height: '10px', width: '40%' }} />
        <div className="skeleton" style={{ height: '12px', width: '90%' }} />
        <div className="skeleton" style={{ height: '12px', width: '70%' }} />
        <div className="skeleton" style={{ height: '16px', width: '30%', marginTop: '4px' }} />
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'done' | 'error';
type Gender = null | 'Men' | 'Women';

export default function Home() {
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState<Gender>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [loadingCopy, setLoadingCopy] = useState(THINKING_COPY[0]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Typewriter
  const [placeholder, setPlaceholder] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Typewriter logic ────────────────────────────────────────────────

  const startTypewriter = useCallback(
    (examples: string[]) => {
      if (isFocused) return;
      const queue = shuffle(examples);
      let qi = 0;
      let ci = 0;
      let deleting = false;
      let paused = false;

      const tick = () => {
        if (isFocused) return;
        const current = queue[qi % queue.length];

        if (paused) {
          paused = false;
          deleting = true;
          typewriterRef.current = setTimeout(tick, 60);
          return;
        }

        if (!deleting) {
          ci++;
          setPlaceholder(current.slice(0, ci));
          if (ci === current.length) {
            paused = true;
            typewriterRef.current = setTimeout(tick, 1600);
          } else {
            typewriterRef.current = setTimeout(tick, 55);
          }
        } else {
          ci--;
          setPlaceholder(current.slice(0, ci));
          if (ci === 0) {
            deleting = false;
            qi++;
            typewriterRef.current = setTimeout(tick, 400);
          } else {
            typewriterRef.current = setTimeout(tick, 28);
          }
        }
      };

      typewriterRef.current = setTimeout(tick, 800);
    },
    [isFocused],
  );

  useEffect(() => {
    const examples =
      gender === 'Men'
        ? EXAMPLES_MEN
        : gender === 'Women'
          ? EXAMPLES_WOMEN
          : EXAMPLES_NEUTRAL;

    if (typewriterRef.current) clearTimeout(typewriterRef.current);
    setPlaceholder('');
    if (!isFocused) startTypewriter(examples);

    return () => {
      if (typewriterRef.current) clearTimeout(typewriterRef.current);
    };
  }, [gender, isFocused, startTypewriter]);

  // ── Loading copy rotation ───────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'loading') return;

    const pool = statusMsg.includes('Searching')
      ? SEARCHING_COPY
      : statusMsg.includes('Curating') || statusMsg.includes('Putting')
        ? CURATING_COPY
        : THINKING_COPY;

    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % pool.length;
      setLoadingCopy(pool[idx]);
    }, 2200);

    return () => clearInterval(interval);
  }, [phase, statusMsg]);

  // ── Search handler ──────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || phase === 'loading') return;

    setPhase('loading');
    setError(null);
    setOutfits([]);
    setLoadingCopy(THINKING_COPY[0]);
    setStatusMsg('Thinking...');

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), gender }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              message?: string;
              result?: Outfit[];
            };

            if (event.type === 'status' && event.message) {
              setStatusMsg(event.message);
              if (event.message.startsWith('Searching')) {
                setLoadingCopy(SEARCHING_COPY[0]);
              } else if (event.message.startsWith('Curating')) {
                setLoadingCopy(CURATING_COPY[0]);
              }
            } else if (event.type === 'done' && event.result) {
              // Normalise: filter out any outfits/items that Claude may have
              // returned without the required fields
              const cleaned = (event.result as Outfit[])
                .filter((o) => o && o.name && Array.isArray(o.items) && o.items.length > 0)
                .map((o) => ({
                  ...o,
                  items: o.items
                    .filter((item) => item && item.category && Array.isArray(item.products) && item.products.length > 0)
                    .map((item) => ({
                      ...item,
                      products: item.products.filter(
                        (p) => p && p.name && p.price && p.productUrl,
                      ),
                    }))
                    .filter((item) => item.products.length > 0),
                }))
                .filter((o) => o.items.length > 0);
              if (cleaned.length > 0) {
                setOutfits(cleaned);
                setPhase('done');
              } else {
                setError('Claude returned no usable outfits. Please try again.');
                setPhase('error');
              }
            } else if (event.type === 'error' && event.message) {
              setError(event.message);
              setPhase('error');
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setPhase('error');
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <main style={{ minHeight: '100dvh', paddingBottom: '4rem' }}>
      {/* ── Header ── */}
      <header
        style={{
          padding: '2rem 1.5rem 1rem',
          textAlign: 'center',
          maxWidth: '680px',
          margin: '0 auto',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            marginBottom: '0.25rem',
            lineHeight: 1.1,
          }}
        >
          Outfit Kurator
        </h1>
        <p
          style={{
            color: 'var(--color-muted)',
            fontSize: '0.9rem',
            fontWeight: 400,
          }}
        >
          AI-curated outfits from Kmart Australia — real prices, real links
        </p>
      </header>

      {/* ── Search form ── */}
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '0 1rem 2rem',
        }}
      >
        {/* Input + button */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '0.75rem',
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isFocused ? '' : (placeholder || 'Describe the look you want...')}
            disabled={phase === 'loading'}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-card)',
              fontSize: '0.9rem',
              color: 'var(--color-text)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
              fontFamily: 'var(--font-sans)',
            }}
            onFocusCapture={(e) => {
              (e.target as HTMLInputElement).style.borderColor =
                'var(--color-accent)';
            }}
            onBlurCapture={(e) => {
              (e.target as HTMLInputElement).style.borderColor =
                'var(--color-border)';
            }}
          />
          <button
            type="submit"
            disabled={!query.trim() || phase === 'loading'}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '10px',
              background:
                !query.trim() || phase === 'loading'
                  ? 'var(--color-border)'
                  : 'var(--color-accent)',
              color: 'white',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor:
                !query.trim() || phase === 'loading'
                  ? 'not-allowed'
                  : 'pointer',
              transition: 'background 0.15s ease',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {phase === 'loading' ? 'Searching...' : 'Build outfits'}
          </button>
        </div>

        {/* Gender toggle */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-muted)',
              marginRight: '0.25rem',
            }}
          >
            Showing:
          </span>
          {(['Men', 'Women'] as Gender[]).map((g) => (
            <button
              key={g}
              type="button"
              className={`gender-pill ${gender === g ? 'active' : ''}`}
              onClick={() => setGender(gender === g ? null : g)}
              disabled={phase === 'loading'}
            >
              {g}
            </button>
          ))}
          {gender && (
            <button
              type="button"
              onClick={() => setGender(null)}
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.2rem 0.4rem',
              }}
            >
              × All
            </button>
          )}
        </div>
      </form>

      {/* ── Loading state ── */}
      {phase === 'loading' && (
        <div
          style={{
            maxWidth: '680px',
            margin: '0 auto',
            padding: '0 1rem',
          }}
          className="animate-fade-in"
        >
          {/* Progress bar */}
          <div className="progress-bar-track" style={{ marginBottom: '2rem' }}>
            <div className="progress-bar-fill" />
          </div>

          {/* Copy */}
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: '1.1rem',
              color: 'var(--color-muted)',
              textAlign: 'center',
              marginBottom: '0.5rem',
            }}
          >
            {loadingCopy}
          </p>
          <p
            style={{
              fontSize: '0.78rem',
              color: 'var(--color-muted)',
              textAlign: 'center',
              opacity: 0.7,
              marginBottom: '2rem',
            }}
          >
            {statusMsg}
          </p>

          {/* Skeleton grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '1rem',
            }}
          >
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {phase === 'error' && error && (
        <div
          style={{
            maxWidth: '500px',
            margin: '0 auto',
            padding: '2rem 1rem',
            textAlign: 'center',
          }}
          className="animate-fade-in"
        >
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.1rem',
              fontStyle: 'italic',
              color: 'var(--color-muted)',
              marginBottom: '0.5rem',
            }}
          >
            Something went wrong
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            {error}
          </p>
          <button
            onClick={() => setPhase('idle')}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              border: '1.5px solid var(--color-border)',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'done' && outfits.length > 0 && (
        <div className="animate-fade-in">
          {/* Result header */}
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              padding: '0 1rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.25rem',
                fontWeight: 400,
              }}
            >
              {outfits.length} outfits for{' '}
              <em>&ldquo;{query}&rdquo;</em>
            </h2>
            <button
              onClick={() => {
                setPhase('idle');
                setOutfits([]);
              }}
              style={{
                fontSize: '0.78rem',
                color: 'var(--color-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              ← New search
            </button>
          </div>

          <OutfitResults outfits={outfits} />
        </div>
      )}

      {/* ── Idle empty state ── */}
      {phase === 'idle' && outfits.length === 0 && (
        <div
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            padding: '1rem 1rem 0',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1rem',
              fontStyle: 'italic',
              color: 'var(--color-muted)',
              lineHeight: 1.6,
            }}
          >
            Try: &ldquo;smart casual look for a job interview&rdquo;,{' '}
            &ldquo;relaxed beach holiday outfit&rdquo;, or{' '}
            &ldquo;cosy winter layers on a budget&rdquo;
          </p>
        </div>
      )}
    </main>
  );
}
