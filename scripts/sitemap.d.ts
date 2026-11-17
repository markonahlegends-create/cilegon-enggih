declare module './scripts/sitemap.mjs' {
  export const generateSitemap: (outDir?: string) => { count: number; domain: string };
  export const sitemapPlugin: () => { name: string; apply: string; closeBundle: () => void };
}
