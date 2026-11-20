// The viewer's script. It runs in the browser from the one HTML file, reads the tree embedded in that file and nothing else, and draws only with textContent
// (no innerHTML), so no text from the scanned code is ever treated as markup. The look is Bootstrap's (its stylesheet, loaded from a CDN); the page works without it.
(function () {
  const data = JSON.parse(document.getElementById('codetree-data').textContent);
  const app = document.getElementById('app');
  const search = document.getElementById('search');
  const classById = new Map(data.classes.map(c => [c.id, c]));
  const features = data.features ?? [];
  const ORDER = ['class', 'interface', 'struct', 'record', 'enum', 'module'];
  const VERB_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const VERB_COLOR = { GET: 'success', POST: 'primary', PUT: 'warning', PATCH: 'warning', DELETE: 'danger' };
  const state = { missingOnly: false };

  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const theme = () => document.documentElement.setAttribute('data-bs-theme', dark.matches ? 'dark' : 'light');
  theme();
  dark.addEventListener('change', theme);

  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return node;
  }
  const link = (text, hash, cls) => el('a', { href: hash, class: cls }, text);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const noText = () => el('span', { class: 'text-body-secondary fst-italic' }, 'no description yet');
  const description = (item, kind) => (kind === 'module' ? el('span', { class: 'text-body-secondary fst-italic' }, 'the functions of this file') : item.summary ? el('span', null, item.summary) : noText());
  const badge = item => (item.generated ? el('span', { class: 'badge text-bg-warning ms-2', title: 'Written by an agent: read it, then keep it with: codetree describe --accept' }, 'generated') : null);
  const code = text => el('code', { class: 'small text-break' }, text);
  const verbBadge = verb => el('span', { class: `badge text-bg-${VERB_COLOR[verb] ?? 'secondary'} me-2` }, verb);
  const tileOf = classId => data.tiles.find(t => t.classes.includes(classId));
  const classLink = (id, text) => (classById.has(id) ? link(text ?? classById.get(id).name, `#/class/${encodeURIComponent(id)}`) : text ?? id);

  function counts(c) {
    const missing = c.members.filter(m => !m.summary).length + (c.summary || c.kind === 'module' ? 0 : 1);
    return { members: c.members.length, missing };
  }

  function crumbs(parts) {
    return el('nav', { 'aria-label': 'Where you are' }, el('ol', { class: 'breadcrumb' },
      parts.map(p => el('li', { class: `breadcrumb-item${p.hash ? '' : ' active'}` }, p.hash ? link(p.text, p.hash) : p.text))));
  }

  function toggle() {
    return el('div', { class: 'form-check form-switch my-2' },
      el('input', { class: 'form-check-input', type: 'checkbox', role: 'switch', id: 'missing', checked: state.missingOnly, onchange: e => { state.missingOnly = e.target.checked; render(); } }),
      el('label', { class: 'form-check-label', for: 'missing' }, 'Show only what has no description'));
  }

  const byRoute = (a, b) => a.path.localeCompare(b.path) || VERB_ORDER.indexOf(a.verb) - VERB_ORDER.indexOf(b.verb);
  const memberOf = (classId, name, line) => classById.get(classId)?.members.find(m => m.name === name && m.line === line) ?? classById.get(classId)?.members.find(m => m.name === name);

  // The home page: one tile per controller, then the other areas (folders) for everything else.
  function overview() {
    const callers = f => new Set(f.endpoints.flatMap(e => e.callers.map(c => c.class))).size;
    const out = [];
    if (features.length) {
      out.push(el('h2', { class: 'h5 mb-1' }, 'Controllers'),
        el('p', { class: 'text-body-secondary small' }, 'Each controller is a feature: open one to see its methods, who calls them and what they call.'),
        el('div', { class: 'row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3 mb-4' }, features.map(f => {
          const owner = classById.get(f.class);
          return el('div', { class: 'col' }, el('a', { href: `#/feature/${encodeURIComponent(f.id)}`, class: 'card h-100 text-decoration-none' }, el('div', { class: 'card-body' },
            el('h3', { class: 'h6 card-title text-body mb-1 text-break' }, f.name), el('p', { class: 'mb-2' }, code('/' + f.route)),
            owner?.summary ? el('p', { class: 'card-text small text-body-secondary mb-2' }, owner.summary) : null,
            el('p', { class: 'card-text small mb-0' }, el('span', { class: 'badge text-bg-secondary me-1' }, plural(f.endpoints.length, 'method', 'methods')),
              el('span', { class: 'badge text-bg-light border' }, `called from ${plural(callers(f), 'front-end class', 'front-end classes')}`)))));
        })));
    }
    out.push(el('h2', { class: 'h5 mb-2' }, features.length ? 'All classes, by area' : 'Areas'),
      el('div', { class: 'row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3 mb-4' }, data.tiles.map(t => {
        const classes = t.classes.map(id => classById.get(id));
        const gap = classes.reduce((n, c) => n + counts(c).missing, 0);
        return el('div', { class: 'col' }, el('a', { href: `#/tile/${encodeURIComponent(t.id)}`, class: 'card h-100 text-decoration-none' }, el('div', { class: 'card-body' },
          el('h3', { class: 'h6 card-title text-body' }, t.name), el('p', { class: 'card-text small text-body-secondary mb-1' }, plural(classes.length, 'class or file', 'classes and files')),
          el('p', { class: `card-text small mb-0 ${gap ? 'text-warning-emphasis' : 'text-success'}`}, gap ? `${gap} without a description` : 'all described'))));
      })));
    return out;
  }

  function areaView(id) {
    const t = data.tiles.find(x => x.id === id);
    if (!t) return notFound();
    return [crumbs([{ text: 'All areas', hash: '#/' }, { text: t.name }]), el('h1', { class: 'h3' }, t.name), classList(t)];
  }

  function classList(t) {
    const classes = t.classes.map(i => classById.get(i)).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.name.localeCompare(b.name));
    const shown = classes.filter(c => !state.missingOnly || counts(c).missing > 0);
    return [toggle(),
      el('ul', { class: 'list-group mb-3' }, shown.map(c => el('li', { class: 'list-group-item d-flex flex-wrap gap-2 align-items-baseline' },
        link(c.name, `#/class/${encodeURIComponent(c.id)}`, 'fw-semibold'), el('span', { class: 'badge text-bg-light border' }, c.kind),
        el('span', { class: 'flex-grow-1' }, description(c, c.kind), badge(c)), el('span', { class: 'text-body-secondary small' }, plural(c.members.length, 'member', 'members'))))),
      shown.length ? null : el('p', { class: 'text-body-secondary fst-italic' }, 'Nothing to show.')];
  }

  // The steps behind a method, as a nested list: what it hands its work to, and what that hands its work to.
  function flowSteps(steps) {
    return el('ul', { class: 'list-unstyled ms-2 ps-3 border-start mb-0' }, steps.map(s => {
      const m = memberOf(s.class, s.member, s.line);
      return el('li', { class: 'mt-1' }, el('span', { class: 'text-body-secondary' }, '→ '), classLink(s.class, `${classById.get(s.class)?.name ?? s.class}.${s.member}`),
        m?.summary ? el('div', { class: 'small text-body-secondary' }, m.summary, badge(m)) : null, s.calls.length ? flowSteps(s.calls) : null);
    }));
  }

  function feature(id) {
    const f = features.find(x => x.id === id);
    if (!f) return notFound();
    const owner = classById.get(f.class);
    return [crumbs([{ text: 'All areas', hash: '#/' }, { text: f.name }]),
      el('h1', { class: 'h3 text-break' }, f.name),
      el('p', null, code('/' + f.route), ' · ', classLink(f.class, 'open the class'), owner ? [' ', code(`${owner.file}:${owner.line}`)] : null),
      owner?.summary ? el('p', { class: 'lead' }, owner.summary, badge(owner)) : null,
      el('h2', { class: 'h5' }, plural(f.endpoints.length, 'method', 'methods')),
      [...f.endpoints].sort(byRoute).map(e => {
        const m = memberOf(f.class, e.member, e.line);
        return el('div', { class: 'card mb-3' },
          el('div', { class: 'card-header d-flex flex-wrap align-items-baseline gap-1' }, verbBadge(e.verb), code('/' + e.path), el('span', { class: 'text-body-secondary small ms-2' }, e.member), el('span', { class: 'ms-auto' }, code(':' + e.line))),
          el('div', { class: 'card-body' },
            el('p', { class: 'mb-2' }, m?.summary ? m.summary : noText(), m ? badge(m) : null),
            el('div', { class: 'row g-3 small' },
              el('div', { class: 'col-md-4' }, el('div', { class: 'fw-semibold mb-1' }, 'Called from (front end)'),
                e.callers.length ? el('ul', { class: 'list-unstyled mb-0' }, e.callers.map(c => el('li', null, classLink(c.class, `${classById.get(c.class)?.name ?? c.class}.${c.member}`)))) : el('span', { class: 'text-body-secondary fst-italic' }, 'no front-end call found')),
              el('div', { class: 'col-md-8' }, el('div', { class: 'fw-semibold mb-1' }, 'Then (back end)'),
                e.flow.length ? flowSteps(e.flow) : el('span', { class: 'text-body-secondary fst-italic' }, 'no calls to other classes found')))));
      })];
  }

  function classView(id) {
    const c = classById.get(id);
    if (!c) return notFound();
    const t = tileOf(c.id);
    const members = c.members.filter(m => !state.missingOnly || !m.summary);
    return [crumbs([{ text: 'All areas', hash: '#/' }, { text: t.name, hash: `#/tile/${encodeURIComponent(t.id)}` }, { text: c.name }]),
      el('h1', { class: 'h3' }, c.name, ' ', el('span', { class: 'badge text-bg-light border align-middle fs-6' }, c.kind)),
      el('p', null, c.namespace ? `${c.namespace} · ` : '', code(`${c.file}:${c.line}`)),
      c.signature ? el('p', null, code(c.signature)) : null,
      el('p', { class: 'lead' }, description(c, c.kind), badge(c)),
      toggle(),
      el('ul', { class: 'list-group mb-3' }, members.map(m => el('li', { class: 'list-group-item' },
        el('div', { class: 'd-flex flex-wrap gap-2 align-items-baseline' }, el('span', { class: 'fw-semibold' }, m.name), el('span', { class: 'badge text-bg-light border' }, m.kind),
          el('span', { class: 'ms-auto text-body-secondary small' }, code(`${m.file ?? c.file}:${m.line}`))),
        el('div', null, description(m), badge(m)), el('div', null, code(m.signature))))),
      members.length ? null : el('p', { class: 'text-body-secondary fst-italic' }, 'Nothing to show.')];
  }

  function results(query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = [];
    const matches = (...texts) => { const all = texts.join(' ').toLowerCase(); return words.every(w => all.includes(w)); };
    for (const c of data.classes) {
      if (matches(c.name, c.summary, c.file, c.kind)) hits.push({ c, text: c.name, kind: c.kind, summary: c.summary, line: c.line });
      for (const m of c.members) if (matches(m.name, m.summary, m.signature, c.name)) hits.push({ c, text: `${c.name}.${m.name}`, kind: m.kind, summary: m.summary, line: m.line });
    }
    return [crumbs([{ text: 'All areas', hash: '#/' }, { text: `Search: ${query}` }]),
      el('p', { class: 'text-body-secondary' }, `${plural(hits.length, 'result', 'results')}${hits.length > 200 ? ', the first 200 shown' : ''}.`),
      el('ul', { class: 'list-group mb-3' }, hits.slice(0, 200).map(h => el('li', { class: 'list-group-item d-flex flex-wrap gap-2 align-items-baseline' },
        link(h.text, `#/class/${encodeURIComponent(h.c.id)}`, 'fw-semibold'), el('span', { class: 'badge text-bg-light border' }, h.kind),
        el('span', { class: 'flex-grow-1' }, h.summary || noText()), code(`${h.c.file}:${h.line}`))))];
  }

  function notFound() { return [el('p', { class: 'text-body-secondary fst-italic' }, 'That is not in this tree.'), link('Back to all areas', '#/')]; }

  function footer() {
    const langs = Object.entries(data.skipped.languages);
    const notes = [];
    if (langs.length) notes.push(`Skipped files in unsupported languages: ${langs.map(([l, n]) => `${l} ${n}`).join(', ')}.`);
    if (data.skipped.generated) notes.push(`Skipped ${plural(data.skipped.generated, 'generated or minified file', 'generated or minified files')}.`);
    if (data.skipped.ignored) notes.push(`Left out ${plural(data.skipped.ignored, 'file or folder', 'files and folders')} that the project's .gitignore ignores.`);
    if (data.skipped.tooBig) notes.push(`Skipped ${plural(data.skipped.tooBig, 'file', 'files')} over 1 MB.`);
    return notes.map(n => el('p', { class: 'text-body-secondary small mb-1' }, n));
  }

  function render() {
    const [kind, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
    const value = decodeURIComponent(rest.join('/'));
    const body = kind === 'tile' ? areaView(value) : kind === 'class' ? classView(value) : kind === 'feature' ? feature(value) : kind === 'search' ? results(value) : overview();
    app.replaceChildren(...body.flat().filter(Boolean), el('hr'), ...footer());
    window.scrollTo(0, 0);
  }

  search.addEventListener('input', () => { location.hash = search.value.trim() ? `#/search/${encodeURIComponent(search.value.trim())}` : '#/'; });
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/search/')) search.value = ''; render(); });
  document.getElementById('title').textContent = `Code tree · ${data.root}`;
  render();
})();
