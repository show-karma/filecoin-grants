/**
 * Renders a very small inline subset of Markdown for copy held in data files:
 * `**bold**` and `[label](href)`.
 *
 * Everything is HTML-escaped first, so the output is safe to pass to `set:html`
 * even though the input is authored copy rather than user input.
 */
const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Only http(s), mailto and site-relative destinations are allowed. */
const safeHref = (href: string) =>
  /^(https?:\/\/|mailto:|\/)/i.test(href) ? href : "#";

export const renderInline = (text: string): string => {
  let html = escapeHtml(text);

  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_match, label: string, href: string) => {
      const url = safeHref(href);
      const external = url.startsWith("http");
      const attrs = external
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";
      return `<a href="${url}" class="text-accent underline underline-offset-4"${attrs}>${label}</a>`;
    },
  );

  html = html.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="font-semibold text-ink">$1</strong>',
  );

  return html;
};
