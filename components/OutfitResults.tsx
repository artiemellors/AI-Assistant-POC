'use client';

import { useState, useCallback, useRef } from 'react';

export interface Product {
  name: string;
  price: string;
  productUrl: string;
  imageUrl: string;
}

export interface OutfitItem {
  category: string;
  products: Product[];
}

export interface Outfit {
  name: string;
  description: string;
  items: OutfitItem[];
}

function parsePrice(price: string): number {
  const m = price.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

function getTotal(outfit: Outfit, indices: number[]): number {
  return (outfit?.items ?? []).reduce((sum, item, i) => {
    const p = item.products[indices[i]] ?? item.products[0];
    return sum + parsePrice(p?.price ?? '0');
  }, 0);
}

interface ProductCardProps {
  item: OutfitItem;
  selectedIdx: number;
  onPrev: () => void;
  onNext: () => void;
}

function ProductCard({ item, selectedIdx, onPrev, onNext }: ProductCardProps) {
  const product = item.products[selectedIdx] ?? item.products[0];
  const imgRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLSpanElement>(null);

  const handleSwap = (dir: 'prev' | 'next') => {
    // Jiggle image
    imgRef.current?.classList.remove('img-jiggle');
    void imgRef.current?.offsetWidth; // reflow
    imgRef.current?.classList.add('img-jiggle');

    // Bounce price
    priceRef.current?.classList.remove('price-bounce');
    void priceRef.current?.offsetWidth;
    priceRef.current?.classList.add('price-bounce');

    if (dir === 'prev') onPrev();
    else onNext();
  };

  const count = item.products.length;

  return (
    <div className="item-card animate-fade-up">
      {/* Image */}
      <div className="product-img-wrap" ref={imgRef}>
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--color-muted)',
              fontSize: '0.75rem',
              textAlign: 'center',
              padding: '1rem',
            }}
          >
            {product.name}
          </div>
        )}

        {/* Arrow controls (only if multiple alternatives) */}
        {count > 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: '0.5rem',
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 0.5rem',
            }}
          >
            <button
              className="arrow-btn"
              onClick={() => handleSwap('prev')}
              aria-label="Previous product"
            >
              ‹
            </button>
            <button
              className="arrow-btn"
              onClick={() => handleSwap('next')}
              aria-label="Next product"
            >
              ›
            </button>
          </div>
        )}

        {/* Alternative counter */}
        {count > 1 && (
          <div
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              background: 'rgba(255,255,255,0.85)',
              borderRadius: '9999px',
              padding: '0.15rem 0.5rem',
              fontSize: '0.7rem',
              color: 'var(--color-muted)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {selectedIdx + 1}/{count}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '0.75rem' }}>
        <p
          style={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-accent)',
            fontWeight: 600,
            marginBottom: '0.2rem',
          }}
        >
          {item.category}
        </p>
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--color-text)',
            fontWeight: 500,
            lineHeight: 1.3,
            marginBottom: '0.5rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {product.name}
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            ref={priceRef}
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--color-text)',
              display: 'inline-block',
            }}
          >
            {product.price}
          </span>
          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-accent)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            View →
          </a>
        </div>
      </div>
    </div>
  );
}

export default function OutfitResults({ outfits }: { outfits: Outfit[] }) {
  const [activeOutfit, setActiveOutfit] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<number[][]>(() =>
    outfits.map((o) => (o.items ?? []).map(() => 0)),
  );
  const totalRef = useRef<HTMLSpanElement>(null);

  const handleSwap = useCallback(
    (outfitIdx: number, itemIdx: number, dir: 1 | -1) => {
      setSelectedIndices((prev) => {
        const next = prev.map((row) => [...row]);
        const count = outfits[outfitIdx].items[itemIdx].products.length;
        next[outfitIdx][itemIdx] =
          (next[outfitIdx][itemIdx] + dir + count) % count;
        return next;
      });
      // Bounce total in sidebar
      totalRef.current?.classList.remove('price-bounce');
      void totalRef.current?.offsetWidth;
      totalRef.current?.classList.add('price-bounce');
    },
    [outfits],
  );

  const outfit = outfits[activeOutfit] ?? outfits[0];
  const items = outfit?.items ?? [];
  const indices = selectedIndices[activeOutfit] ?? items.map(() => 0);
  const total = getTotal(outfit, indices);

  return (
    <div
      style={{
        display: 'flex',
        gap: '2rem',
        alignItems: 'flex-start',
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '0 1rem',
      }}
    >
      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Outfit tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          {outfits.map((o, i) => (
            <button
              key={i}
              className={`outfit-tab ${i === activeOutfit ? 'active' : ''}`}
              onClick={() => setActiveOutfit(i)}
            >
              {o.name}
            </button>
          ))}
        </div>

        {/* Outfit description */}
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.05rem',
            fontStyle: 'italic',
            color: 'var(--color-muted)',
            marginBottom: '1.25rem',
            lineHeight: 1.5,
          }}
        >
          {outfit.description}
        </p>

        {/* Product grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '1rem',
          }}
        >
          {items.map((item, itemIdx) => (
            <ProductCard
              key={`${activeOutfit}-${itemIdx}`}
              item={item}
              selectedIdx={indices[itemIdx] ?? 0}
              onPrev={() => handleSwap(activeOutfit, itemIdx, -1)}
              onNext={() => handleSwap(activeOutfit, itemIdx, 1)}
            />
          ))}
        </div>
      </div>

      {/* ── Sticky sidebar ── */}
      <aside
        style={{
          width: '240px',
          flexShrink: 0,
          position: 'sticky',
          top: '1.5rem',
        }}
        className="hidden lg:block"
      >
        <div
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <p
            style={{
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-muted)',
              marginBottom: '0.5rem',
            }}
          >
            Outfit total
          </p>
          <span
            ref={totalRef}
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.8rem',
              fontWeight: 600,
              display: 'inline-block',
              marginBottom: '1rem',
            }}
          >
            ${total.toFixed(2)}
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {items.map((item, itemIdx) => {
              const p = item.products[indices[itemIdx]] ?? item.products[0];
              return (
                <div
                  key={itemIdx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-muted)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.category}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p?.price}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <p
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-muted)',
                lineHeight: 1.4,
              }}
            >
              Use ‹ › arrows on each item to explore alternatives
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
