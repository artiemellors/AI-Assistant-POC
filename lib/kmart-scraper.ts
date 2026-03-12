export interface Product {
  name: string;
  price: string;
  productUrl: string;
  imageUrl: string;
}

const CONSTRUCTOR_KEY = 'key_GZTqlLr41FS2p7AY';

export async function searchKmart(query: string): Promise<Product[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://ac.cnstrc.com/search/${encoded}?key=${CONSTRUCTOR_KEY}&num_results_per_page=24`;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Constructor.io search failed: ${res.status}`);
  }

  const data = await res.json();
  const results: Record<string, unknown>[] = data?.response?.results ?? [];

  return results
    .slice(0, 6)
    .map((item) => {
      const d = (item.data ?? {}) as Record<string, unknown>;
      const raw = d.price ?? d.regular_price ?? d.sale_price;
      const price =
        raw != null ? `$${Number(raw).toFixed(2)}` : 'See website';

      return {
        name: (item.value as string) || (d.name as string) || '',
        price,
        productUrl:
          (d.url as string) ||
          `https://www.kmart.com.au/search?q=${encoded}`,
        imageUrl:
          (d.image_url as string) ||
          (d.imageUrl as string) ||
          (d.image as string) ||
          '',
      };
    })
    .filter((p) => p.name.length > 0);
}
