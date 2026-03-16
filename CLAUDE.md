# Claude Code Instructions

## Kmart Kosmos Design System (MCP)

A local MCP server is running at startup (configured in `.mcp.json`) that gives you access to the Kmart Kosmos design system via its public Storybook.

### Available tools

| Tool | When to use |
|---|---|
| `list_components` | Browse all components, optionally filtered by category |
| `get_component` | Look up docs + story links for a specific component (e.g. "Button", "Card") |
| `get_design_tokens` | Find colour, spacing, typography, and other token docs |
| `search_components` | Search by keyword when you don't know the exact component name |

### When to use these tools

- **Before building any UI** — call `list_components` or `search_components` to find the right Kmart component rather than inventing one.
- **When referencing a specific component** — call `get_component` to get its Storybook docs URL so you can link to it or check its API.
- **When choosing colours, spacing, or typography** — call `get_design_tokens` to find the correct token values from the design system rather than using hardcoded values.

### Example workflow

1. User asks to build a product card UI
2. Call `search_components` with query `"card"` → find `Card` component and its Storybook URL
3. Call `get_design_tokens` with category `"colour"` → confirm token names for brand colours
4. Build the UI referencing the Kosmos component names and token values

### Storybook base URL

`https://kmartau.github.io/kosmos-ds`

All tool results include direct deep-links into this Storybook instance.
