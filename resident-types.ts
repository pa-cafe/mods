/** The kinds of resident a cafe seats. `generic` is any agent that speaks MCP and has no kind of its own. */
export const residentTypes = ['grok_bot', 'hermes', 'dots', 'muse', 'generic'] as const;
export type ResidentType = (typeof residentTypes)[number];
