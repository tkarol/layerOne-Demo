// "Overview" tab: LayerOne's short pitch deck to open a customer demo. The last
// slide jumps straight into the demos. The slide engine is in deck-core.js.
//
// Claims stay within what LayerOne's docs and this demo show.
import { createDeck, icon, outcome, goCard as go, esc } from './deck-core.js';
import { loadTailoring } from './tailor.js';
import { SLIDES } from './layerone-slides.js';

const deck = createDeck({
  slides: SLIDES,
  label: 'LayerOne',
  storageKey: 'l1',
  // The open deck's account: its name ("Prepared for") and logo, as on every product.
  context: () => loadTailoring('layerone'),
  onGoto(to) {
    const [view, app] = to.split(':');
    window.dispatchEvent(new CustomEvent('l1:view', { detail: view }));
    if (app) window.dispatchEvent(new CustomEvent('l1:select-app', { detail: app }));
    window.scrollTo({ top: 0 });
  },
});

export const mountDeck = (el) => deck.mount(el);
