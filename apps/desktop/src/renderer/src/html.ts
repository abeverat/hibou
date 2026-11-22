import DOMPurify from 'dompurify';

// Les liens du contenu EcoleDirecte s'ouvrent dans le navigateur (voir setWindowOpenHandler).
DOMPurify.addHook('afterSanitizeAttributes', (noeud) => {
  if (noeud.tagName === 'A') {
    noeud.setAttribute('target', '_blank');
    noeud.setAttribute('rel', 'noopener noreferrer');
  }
});

/** HTML venant d'EcoleDirecte → HTML sûr à injecter. */
export function htmlSur(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'img'],
    FORBID_ATTR: ['style'],
  });
}

/** Texte seul d'un contenu HTML EcoleDirecte, espaces normalisés (pour les aperçus). */
export function texteBrut(html: string): string {
  const doc = new DOMParser().parseFromString(htmlSur(html), 'text/html');
  doc.querySelectorAll('p, li, br, div').forEach((n) => n.append(' '));
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}
