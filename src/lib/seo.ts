// Utilities to ensure consistent SEO and favicon across the app
export function applySeoDefaults() {
  try {
    // Title
    const defaultTitle = "Capyera - Premium Inventory Management";
    if (document.title !== defaultTitle) document.title = defaultTitle;

    const bust = `v=${Date.now().toString().slice(-6)}`;

    const ensureLink = (rel: string, href: string, type?: string) => {
      let link = document.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        if (type) link.type = type;
        document.head.appendChild(link);
      }
      const url = href.includes("?") ? `${href}&${bust}` : `${href}?${bust}`;
      link.href = url;
    };

    // Favicon links (cover most browsers)
    ensureLink("icon", "/favicon.png", "image/png");
    ensureLink("shortcut icon", "/favicon.png", "image/png");
    ensureLink("apple-touch-icon", "/favicon.png");

    const ensureMeta = (selector: string, name: string, content: string) => {
      let tag = document.querySelector<HTMLMetaElement>(`${selector}[content]`);
      if (!tag) {
        tag = document.createElement("meta");
        // selector like meta[property='og:image'] -> split attr and value
        const match = selector.match(/\[(.*?)='(.*?)'\]/);
        if (match) tag.setAttribute(match[1], match[2]);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    // Social images
    ensureMeta("meta[property='og:image']", "og:image", "/favicon.png");
    ensureMeta("meta[property='twitter:image']", "twitter:image", "/favicon.png");
  } catch (e) {
    // no-op
  }
}
