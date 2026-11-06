// Where this site's backend (the Cloudflare Worker) is. Blank means the same address as
// these pages: the Worker serves both, or `npm start` locally. GitHub Pages only serves
// files, so its build (.github/workflows/pages.yml) writes the Worker's address here.
window.L1_API = '';
// An /api/ path at the backend, for links and images (fetch calls are routed in workspace.js).
window.l1Api = (path) => (window.L1_API ? window.L1_API.replace(/\/+$/, '') + path : path);
