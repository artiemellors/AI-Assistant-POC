import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { searchKmart, type Product } from '@/lib/kmart-scraper';

export const runtime = 'nodejs';
export const maxDuration = 90;

const client = new Anthropic();

interface OutfitItem {
  category: string;
  products: Product[];
}

interface Outfit {
  name: string;
  description: string;
  items: OutfitItem[];
}

const SYSTEM_PROMPT = `You are Outfit Kurator — an AI personal stylist for Kmart Australia.

Your job:
1. Decide which clothing categories to search for the user's request (maximum 5 categories)
2. Search those categories using search_kmart (you may search multiple in one turn)
3. Build 2–4 complete outfit options from the results
4. Call present_outfits with the final curated outfits

Rules:
- Search no more than 5 clothing categories total
- Never search duplicate categories (e.g. "shirt" and "dress shirt" are duplicates — pick one)
- Each outfit must be complete: at minimum a top and a bottom
- Accessories (belt, bag, shoes, hat) are optional extras
- Use ONLY real products returned by search_kmart — never invent products or URLs
- For each outfit item, include ALL products from that category's search as the alternatives array (so the user can swap through options)
- Strip all emojis from outfit names and descriptions
- Outfit names and descriptions must be concise and professional (no emojis, no "✨" etc.)
- Make the outfits meaningfully different from one another (different styles, not just different colours)
- Prefer items with an imageUrl when building outfits`;

const tools: Anthropic.Tool[] = [
  {
    name: 'search_kmart',
    description:
      "Search Kmart Australia's product catalogue for a clothing category. Returns up to 6 products with name, price, imageUrl, and productUrl. Call once per category.",
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            "A specific clothing category to search, e.g. \"men's chinos\", \"women's linen blazer\", \"leather belt\"",
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'present_outfits',
    description:
      'Present 2–4 complete outfit recommendations. Call this once you have searched all necessary categories and assembled the outfits.',
    input_schema: {
      type: 'object',
      properties: {
        outfits: {
          type: 'array',
          description: 'Array of 2–4 complete outfit options',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Short outfit name, no emojis',
              },
              description: {
                type: 'string',
                description: 'One-sentence style description, no emojis',
              },
              items: {
                type: 'array',
                description: 'Clothing items making up this outfit',
                items: {
                  type: 'object',
                  properties: {
                    category: {
                      type: 'string',
                      description:
                        'Category label shown to the user, e.g. "Shirt", "Trousers", "Belt"',
                    },
                    products: {
                      type: 'array',
                      description:
                        'All products from this category search (first = hero product for this outfit)',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          price: { type: 'string' },
                          productUrl: { type: 'string' },
                          imageUrl: { type: 'string' },
                        },
                        required: ['name', 'price', 'productUrl', 'imageUrl'],
                      },
                    },
                  },
                  required: ['category', 'products'],
                },
              },
            },
            required: ['name', 'description', 'items'],
          },
        },
      },
      required: ['outfits'],
    },
  },
];

export async function POST(req: NextRequest) {
  const { query, gender } = (await req.json()) as {
    query: string;
    gender?: string;
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const genderClause = gender
          ? `\n\nGENDER CONSTRAINT: The user selected "${gender}". Every single search_kmart query MUST be prefixed with "${gender.toLowerCase()}'s" — e.g. "${gender.toLowerCase()}'s chinos", not just "chinos". This is mandatory without exception.`
          : '';

        const messages: Anthropic.MessageParam[] = [
          {
            role: 'user',
            content: `Build complete outfit options for: "${query}"${gender ? ` (${gender}'s clothing only)` : ''}`,
          },
        ];

        send({ type: 'status', message: 'Studying your vibe...' });

        // Agentic loop
        for (let turn = 0; turn < 8; turn++) {
          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: SYSTEM_PROMPT + genderClause,
            tools,
            tool_choice: { type: 'any' }, // force tool use on every turn
            messages,
          });

          messages.push({ role: 'assistant', content: response.content });

          // Check for present_outfits — terminates the loop
          const presentCall = response.content.find(
            (b): b is Anthropic.ToolUseBlock =>
              b.type === 'tool_use' && b.name === 'present_outfits',
          );

          if (presentCall) {
            const input = presentCall.input as { outfits?: unknown };
            const rawOutfits = Array.isArray(input?.outfits) ? (input.outfits as Outfit[]) : null;

            if (!rawOutfits || rawOutfits.length === 0) {
              send({ type: 'error', message: 'No outfits returned. Please try again.' });
              controller.close();
              return;
            }

            // Strip any lingering emojis from names/descriptions
            const clean = rawOutfits.map((o) => ({
              ...o,
              name: stripEmoji(o.name ?? ''),
              description: stripEmoji(o.description ?? ''),
            }));
            send({ type: 'done', result: clean });
            controller.close();
            return;
          }

          // Handle search_kmart calls — run in parallel
          const searchCalls = response.content.filter(
            (b): b is Anthropic.ToolUseBlock =>
              b.type === 'tool_use' && b.name === 'search_kmart',
          );

          if (searchCalls.length === 0) {
            send({
              type: 'error',
              message: 'No results found. Try a different search.',
            });
            controller.close();
            return;
          }

          for (const call of searchCalls) {
            const { query: q } = call.input as { query: string };
            send({ type: 'status', message: `Searching for "${q}"...` });
          }

          const results = await Promise.all(
            searchCalls.map(async (call) => {
              const { query: q } = call.input as { query: string };
              try {
                const products = await searchKmart(q);
                send({
                  type: 'status',
                  message: `Found ${products.length} options for "${q}"`,
                });
                return { id: call.id, products };
              } catch {
                return { id: call.id, products: [] as Product[] };
              }
            }),
          );

          const toolResults: Anthropic.ToolResultBlockParam[] = results.map(
            ({ id, products }) => ({
              type: 'tool_result',
              tool_use_id: id,
              content: JSON.stringify(products),
            }),
          );

          messages.push({ role: 'user', content: toolResults });
          send({ type: 'status', message: 'Curating your outfits...' });
        }

        send({
          type: 'error',
          message: 'Took too long to build outfits. Please try again.',
        });
        controller.close();
      } catch (err) {
        send({ type: 'error', message: String(err) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function stripEmoji(str: string): string {
  // Remove common emoji ranges (no /u flag for TS compatibility)
  /* eslint-disable no-control-regex */
  return str
    .replace(/[\uD800-\uDFFF]/g, '') // surrogate pairs (emoji)
    .replace(/[\u2600-\u27BF]/g, '') // misc symbols & dingbats
    .replace(/[\uFE00-\uFE0F]/g, '') // variation selectors
    .replace(/\s+/g, ' ')
    .trim();
}
