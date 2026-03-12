import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const STORYBOOK_BASE = 'https://kmartau.github.io/kosmos-ds';

// Token categories that map to design foundation stories
const TOKEN_TITLES = ['tokens', 'foundation', 'foundations'];

let cachedIndex = null;

async function fetchIndex() {
  if (cachedIndex) return cachedIndex;
  const res = await fetch(`${STORYBOOK_BASE}/index.json`);
  if (!res.ok) throw new Error(`Failed to fetch design system index: ${res.status}`);
  cachedIndex = await res.json();
  return cachedIndex;
}

function buildStorybookUrl(entry) {
  const mode = entry.type === 'docs' ? 'docs' : 'story';
  return `${STORYBOOK_BASE}/?path=/${mode}/${entry.id}`;
}

function groupEntriesByCategory(entries) {
  const categories = {};
  const seen = new Set();

  for (const entry of Object.values(entries)) {
    const parts = entry.title.split('/');
    const category = parts[0].trim();
    const componentName = parts.slice(1).join(' / ').trim() || entry.title;

    // Use a dedupe key so we only show one entry per component title
    const dedupeKey = entry.title.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    if (!categories[category]) categories[category] = [];
    categories[category].push({
      id: entry.id,
      name: componentName || category,
      title: entry.title,
      type: entry.type,
      url: buildStorybookUrl(entry),
    });
  }

  // Sort components within each category alphabetically
  for (const cat of Object.values(categories)) {
    cat.sort((a, b) => a.name.localeCompare(b.name));
  }

  return categories;
}

function findComponentEntries(entries, query) {
  const q = query.toLowerCase();
  return Object.values(entries).filter((entry) => {
    return (
      entry.title.toLowerCase().includes(q) ||
      entry.id.toLowerCase().includes(q) ||
      entry.name?.toLowerCase().includes(q)
    );
  });
}

// --- Tool handlers ---

async function handleListComponents(args) {
  const { category } = args || {};
  const index = await fetchIndex();
  const grouped = groupEntriesByCategory(index.entries);

  if (category) {
    const key = Object.keys(grouped).find(
      (k) => k.toLowerCase() === category.toLowerCase()
    );
    if (!key) {
      const available = Object.keys(grouped).join(', ');
      return `Category "${category}" not found. Available categories: ${available}`;
    }
    const components = grouped[key];
    const lines = components.map((c) => `- **${c.name}** — ${c.url}`);
    return `## ${key} (${components.length} components)\n\n${lines.join('\n')}`;
  }

  const sections = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, components]) => {
      const names = components.map((c) => c.name).join(', ');
      return `### ${cat} (${components.length})\n${names}`;
    });

  return `# Kmart Kosmos Design System Components\n\n${sections.join('\n\n')}\n\nUse \`get_component\` with a component name for details, or \`list_components\` with a category name to see URLs.`;
}

async function handleGetComponent(args) {
  const { name } = args || {};
  if (!name) return 'Please provide a component name.';

  const index = await fetchIndex();
  const matches = findComponentEntries(index.entries, name);

  if (matches.length === 0) {
    return `No component found matching "${name}". Try \`search_components\` to browse available components.`;
  }

  // Prefer docs entries, then fall back to stories
  const docs = matches.filter((e) => e.type === 'docs');
  const stories = matches.filter((e) => e.type === 'story');

  const primary = docs[0] || stories[0];
  const allStories = stories.filter((s) => s.title === primary.title || docs.some((d) => d.title === s.title));

  const lines = [
    `## ${primary.title}`,
    ``,
    `**Docs:** ${buildStorybookUrl(primary.type === 'docs' ? primary : (docs[0] || primary))}`,
  ];

  if (allStories.length > 0) {
    lines.push(``, `**Stories:**`);
    for (const s of allStories) {
      lines.push(`- ${s.name} — ${buildStorybookUrl(s)}`);
    }
  }

  if (matches.length > allStories.length + (docs.length > 0 ? 1 : 0)) {
    const others = matches
      .filter((m) => m.title !== primary.title)
      .map((m) => `- ${m.title} — ${buildStorybookUrl(m)}`);
    if (others.length > 0) {
      lines.push(``, `**Related components:**`, ...others);
    }
  }

  return lines.join('\n');
}

async function handleGetDesignTokens(args) {
  const { category } = args || {};
  const index = await fetchIndex();

  const tokenEntries = Object.values(index.entries).filter((entry) => {
    const titleLower = entry.title.toLowerCase();
    return TOKEN_TITLES.some((t) => titleLower.startsWith(t));
  });

  if (tokenEntries.length === 0) {
    return 'No design token entries found in the design system index.';
  }

  let filtered = tokenEntries;
  if (category) {
    filtered = tokenEntries.filter((e) =>
      e.title.toLowerCase().includes(category.toLowerCase())
    );
    if (filtered.length === 0) {
      const available = [...new Set(tokenEntries.map((e) => e.title.split('/')[1]).filter(Boolean))].join(', ');
      return `No token category matching "${category}". Available: ${available}`;
    }
  }

  // Dedupe by title
  const seen = new Set();
  const unique = filtered.filter((e) => {
    if (seen.has(e.title)) return false;
    seen.add(e.title);
    return true;
  });

  const lines = [
    `## Kmart Kosmos Design Tokens`,
    category ? `\nFiltered by: **${category}**` : '',
    '',
    ...unique.map((e) => {
      const tokenName = e.title.split('/').slice(1).join(' / ') || e.title;
      return `- **${tokenName}** — ${buildStorybookUrl(e)}`;
    }),
    '',
    `> Open the links above in Storybook to see exact token values (colours, spacing, typography, etc.).`,
  ];

  return lines.filter((l) => l !== undefined).join('\n');
}

async function handleSearchComponents(args) {
  const { query } = args || {};
  if (!query) return 'Please provide a search query.';

  const index = await fetchIndex();
  const matches = findComponentEntries(index.entries, query);

  if (matches.length === 0) {
    return `No results for "${query}".`;
  }

  // Dedupe by title, prefer docs
  const byTitle = {};
  for (const m of matches) {
    if (!byTitle[m.title] || m.type === 'docs') {
      byTitle[m.title] = m;
    }
  }

  const results = Object.values(byTitle).sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  const lines = results.map((r) => `- **${r.title}** — ${buildStorybookUrl(r)}`);
  return `## Search results for "${query}" (${results.length} found)\n\n${lines.join('\n')}`;
}

// --- Server setup ---

const server = new Server(
  { name: 'kmart-design-system', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_components',
      description:
        'List all components in the Kmart Kosmos design system, optionally filtered by category. Categories include: inputs, data display, navigation, surfaces, layout, feedback, tokens.',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description:
              'Optional category name to filter by (e.g. "inputs", "layout", "data display")',
          },
        },
      },
    },
    {
      name: 'get_component',
      description:
        'Get Storybook docs and story links for a specific Kmart Kosmos component by name (e.g. "Button", "Card", "TextField").',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Component name or partial name to look up',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'get_design_tokens',
      description:
        'Get design token documentation links from the Kmart Kosmos design system. Tokens include colours, spacing, typography, radius, breakpoints, and icons.',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description:
              'Optional token category to filter by (e.g. "colour", "spacing", "typography", "radius", "breakpoints")',
          },
        },
      },
    },
    {
      name: 'search_components',
      description:
        'Search for components in the Kmart Kosmos design system by name or keyword.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term (e.g. "badge", "carousel", "nav")',
          },
        },
        required: ['query'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    switch (name) {
      case 'list_components':
        result = await handleListComponents(args);
        break;
      case 'get_component':
        result = await handleGetComponent(args);
        break;
      case 'get_design_tokens':
        result = await handleGetDesignTokens(args);
        break;
      case 'search_components':
        result = await handleSearchComponents(args);
        break;
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return { content: [{ type: 'text', text: result }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
