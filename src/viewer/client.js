// The viewer's script. It runs in the browser from the one HTML file, reads the tree embedded in that file and nothing else, and draws only with textContent
// (no innerHTML), so no text from the scanned code is ever treated as markup. The look is Bootstrap's (its stylesheet, loaded from a CDN) plus viewer.css.
(function () {
  const data = JSON.parse(document.getElementById('codetree-data').textContent);
  const app = document.getElementById('app');
  const search = document.getElementById('search');
  const classById = new Map(data.classes.map(c => [c.id, c]));
  const features = data.features ?? [];
  const ORDER = ['class', 'interface', 'struct', 'record', 'enum', 'module'];
  const VERB_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const state = { missingOnly: false, text: '', verbs: new Set() };

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
  const hueOf = text => { let h = 0; for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const initials = name => (name.replace(/Controller$/, '').match(/[A-Z][a-z0-9]*/g) ?? [name]).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const noText = () => el('span', { class: 'text-body-secondary fst-italic' }, 'no description yet');
  const description = (item, kind) => (kind === 'module' ? el('span', { class: 'text-body-secondary fst-italic' }, 'the functions of this file') : item.summary ? el('span', null, item.summary) : noText());
  const badge = item => (item.generated ? el('span', { class: 'badge rounded-pill text-bg-warning ms-2', title: 'Written by an agent: read it, then keep it with: codetree describe --accept' }, '✨ generated') : null);
  const code = text => el('code', { class: 'small text-break' }, text);
  const verbPill = (verb, extra) => el('span', { class: `verb verb-${verb}` }, verb, extra != null ? el('b', null, extra) : null);
  const kindPill = kind => el('span', { class: `kind kind-${kind}` }, kind);
  const tileOf = classId => data.tiles.find(t => t.classes.includes(classId));
  const classLink = (id, text) => (classById.has(id) ? link(text ?? classById.get(id).name, `#/class/${encodeURIComponent(id)}`) : text ?? id);
  const icon = name => (/back|api|server/i.test(name) ? '⚙️' : /front|web|app|ui/i.test(name) ? '🖥️' : /test|load/i.test(name) ? '🧪' : '📦');

  function counts(c) {
    const missing = c.members.filter(m => !m.summary).length + (c.summary || c.kind === 'module' ? 0 : 1);
    return { members: c.members.length, missing };
  }

  function crumbs(parts) {
    return el('nav', { 'aria-label': 'Where you are' }, el('ol', { class: 'breadcrumb crumbs' },
      parts.map(p => el('li', { class: `breadcrumb-item${p.hash ? '' : ' active'}` }, p.hash ? link(p.text, p.hash) : p.text))));
  }

  function toggle() {
    return el('div', { class: 'form-check form-switch my-2' },
      el('input', { class: 'form-check-input', type: 'checkbox', role: 'switch', id: 'missing', checked: state.missingOnly, onchange: e => { state.missingOnly = e.target.checked; render(); } }),
      el('label', { class: 'form-check-label', for: 'missing' }, 'Show only what has no description'));
  }

  const byRoute = (a, b) => a.path.localeCompare(b.path) || VERB_ORDER.indexOf(a.verb) - VERB_ORDER.indexOf(b.verb);
  const memberOf = (classId, name, line) => classById.get(classId)?.members.find(m => m.name === name && m.line === line) ?? classById.get(classId)?.members.find(m => m.name === name);
  const verbCounts = f => VERB_ORDER.map(v => [v, f.endpoints.filter(e => e.verb === v).length]).filter(([, n]) => n);
  const callersOf = f => new Set(f.endpoints.flatMap(e => e.callers.map(c => `${c.class}.${c.member}`))).size;

  // ---- the home page: numbers, then the areas as big colourful tiles
  function stat(value, label, hue) {
    return el('div', { class: 'col' }, el('div', { class: 'stat', style: `--h:${hue}` }, el('div', { class: 'stat-value' }, String(value)), el('div', { class: 'stat-label' }, label)));
  }

  function stats() {
    const endpoints = features.flatMap(f => f.endpoints);
    const members = data.classes.reduce((n, c) => n + c.members.length, 0);
    return el('div', { class: 'row row-cols-2 row-cols-lg-4 g-3 mb-4' }, [
      stat(features.length, 'controllers', 265), stat(endpoints.length, 'endpoints', 330),
      stat(endpoints.filter(e => e.callers.length).length, 'used by the front end', 150), stat(`${data.classes.length} · ${members}`, 'classes · members', 25)]);
  }

  function areaTiles(selectedId) {
    return el('div', { class: 'row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3 mb-4' }, data.tiles.map(t => {
      const classes = t.classes.map(id => classById.get(id));
      const gap = classes.reduce((n, c) => n + counts(c).missing, 0);
      const items = classes.reduce((n, c) => n + c.members.length + 1, 0);
      const done = items ? Math.round(100 * (1 - gap / items)) : 100;
      const own = features.filter(f => t.classes.includes(f.class)).length;
      return el('div', { class: 'col' }, el('a', { href: `#/tile/${encodeURIComponent(t.id)}`, class: `area${t.id === selectedId ? ' selected' : ''}`, style: `--h:${hueOf(t.id)}` },
        el('div', { class: 'area-icon' }, icon(t.name)),
        el('h2', { class: 'h4 mb-1' }, t.name),
        el('p', { class: 'mb-2 opacity-75' }, plural(classes.length, 'class or file', 'classes and files'), own ? ` · ${plural(own, 'controller', 'controllers')}` : ''),
        el('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Described', 'aria-valuenow': done, 'aria-valuemin': 0, 'aria-valuemax': 100 }, el('div', { class: 'progress-bar', style: `width:${done}%` })),
        el('small', { class: 'opacity-75' }, gap ? `${done}% described · ${gap} to go` : 'all described ✓')));
    }));
  }

  function overview() {
    return [el('div', { class: 'hero' }, el('h1', { class: 'display-6 fw-bold mb-1' }, `Explore ${data.root}`),
      el('p', { class: 'mb-0' }, 'Pick an area. The back end opens as one tile per controller; open a controller to follow each method from the screen that calls it to the code behind it.')),
      stats(), el('h2', { class: 'h5 mb-3' }, 'Areas'), areaTiles(null)];
  }

  // ---- an area: for the back end, one tile per controller, with a live filter
  function controllerTile(f) {
    const owner = classById.get(f.class);
    const callers = callersOf(f);
    const tile = el('div', { class: 'col ctl', 'data-name': f.name.toLowerCase(), 'data-text': `${f.route} ${owner?.summary ?? ''}`.toLowerCase(), 'data-verbs': verbCounts(f).map(([v]) => v).join(' ') },
      el('a', { href: `#/feature/${encodeURIComponent(f.id)}`, class: 'ctl-card', style: `--h:${hueOf(f.name)}` },
        el('div', { class: 'ctl-head' }, el('span', { class: 'avatar' }, initials(f.name)),
          el('div', { class: 'min-w-0' }, el('h3', { class: 'h6 mb-0 text-break' }, f.name.replace(/Controller$/, ''), el('span', { class: 'text-body-secondary fw-normal' }, 'Controller')), code('/' + f.route))),
        owner?.summary ? el('p', { class: 'ctl-text' }, owner.summary) : el('p', { class: 'ctl-text' }, noText()),
        el('div', { class: 'ctl-foot' }, el('div', { class: 'd-flex flex-wrap gap-1' }, verbCounts(f).map(([v, n]) => verbPill(v, n))),
          el('span', { class: 'ctl-callers', title: 'Front-end functions that call this controller' }, `🖥️ ${callers}`))));
    return tile;
  }

  function applyFilter(root) {
    const words = state.text.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    const tiles = root.querySelectorAll('.ctl');
    for (const tile of tiles) {
      const hay = `${tile.dataset.name} ${tile.dataset.text}`;
      const okText = words.every(w => hay.includes(w));
      const okVerb = !state.verbs.size || [...state.verbs].some(v => tile.dataset.verbs.split(' ').includes(v));
      tile.classList.toggle('d-none', !(okText && okVerb));
      if (okText && okVerb) shown++;
    }
    const count = root.querySelector('.ctl-count');
    if (count) count.textContent = shown === tiles.length ? plural(tiles.length, 'controller', 'controllers') : `${shown} of ${tiles.length} controllers`;
    const none = root.querySelector('.ctl-none');
    if (none) none.classList.toggle('d-none', shown > 0);
  }

  function controllerSection(t, own) {
    const grid = el('div', { class: 'row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3 mb-4' }, own.map(controllerTile));
    const section = el('section', null,
      el('div', { class: 'toolbar' },
        el('h2', { class: 'h5 mb-0' }, `${t.name}: `, el('span', { class: 'ctl-count' })),
        el('input', { class: 'form-control form-control-sm filter', type: 'search', placeholder: '🔎 Filter controllers by name, route or text', 'aria-label': 'Filter controllers', value: state.text,
          oninput: e => { state.text = e.target.value; applyFilter(section); } }),
        el('div', { class: 'd-flex flex-wrap gap-1' }, VERB_ORDER.filter(v => own.some(f => f.endpoints.some(e => e.verb === v))).map(v =>
          el('button', { type: 'button', class: `verb verb-${v} chip${state.verbs.has(v) ? ' on' : ''}`, 'aria-pressed': state.verbs.has(v), title: `Only controllers with a ${v}`,
            onclick: e => { state.verbs.has(v) ? state.verbs.delete(v) : state.verbs.add(v); e.currentTarget.classList.toggle('on', state.verbs.has(v)); e.currentTarget.setAttribute('aria-pressed', state.verbs.has(v)); applyFilter(section); } }, v)))),
      grid, el('p', { class: 'ctl-none d-none text-body-secondary fst-italic' }, 'No controller matches the filter.'));
    applyFilter(section);
    return section;
  }

  function areaView(id) {
    const t = data.tiles.find(x => x.id === id);
    if (!t) return notFound();
    const own = features.filter(f => t.classes.includes(f.class));
    const classes = plural(t.classes.length, 'class or file', 'classes and files');
    return [areaTiles(id),
      own.length
        ? [controllerSection(t, own), el('details', { class: 'more mb-4' }, el('summary', null, `${t.name}: all ${classes}`), classList(t))]
        : [el('h2', { class: 'h5' }, `${t.name}: ${classes}`), classList(t)]];
  }

  function classList(t) {
    const classes = t.classes.map(i => classById.get(i)).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.name.localeCompare(b.name));
    const shown = classes.filter(c => !state.missingOnly || counts(c).missing > 0);
    return [toggle(),
      el('ul', { class: 'list-group rowlist mb-3' }, shown.map(c => el('li', { class: 'list-group-item d-flex flex-wrap gap-2 align-items-baseline', style: `--h:${hueOf(c.name)}` },
        link(c.name, `#/class/${encodeURIComponent(c.id)}`, 'fw-semibold'), kindPill(c.kind),
        el('span', { class: 'flex-grow-1' }, description(c, c.kind), badge(c)), el('span', { class: 'badge rounded-pill text-bg-secondary' }, plural(c.members.length, 'member', 'members'))))),
      shown.length ? null : el('p', { class: 'text-body-secondary fst-italic' }, 'Nothing to show.')];
  }

  // ---- a controller: its methods as cards you can open, each with the front-end callers and the back-end flow
  function flowSteps(steps, depth) {
    return el('ul', { class: `flow flow-${depth}` }, steps.map(s => {
      const m = memberOf(s.class, s.member, s.line);
      return el('li', null, el('span', { class: 'step' }, classLink(s.class, `${classById.get(s.class)?.name ?? s.class}.${s.member}`)),
        m?.summary ? el('div', { class: 'small text-body-secondary mt-1' }, m.summary, badge(m)) : null, s.calls.length ? flowSteps(s.calls, depth + 1) : null);
    }));
  }

  function endpointCard(f, e) {
    const m = memberOf(f.class, e.member, e.line);
    return el('details', { class: `endpoint endpoint-${e.verb}`, open: true },
      el('summary', null, verbPill(e.verb), code('/' + e.path), el('span', { class: 'text-body-secondary small' }, e.member),
        el('span', { class: 'ms-auto d-flex gap-1' }, el('span', { class: 'badge rounded-pill text-bg-primary', title: 'Front-end functions that call it' }, `🖥️ ${e.callers.length}`),
          el('span', { class: 'badge rounded-pill text-bg-info', title: 'Steps behind it' }, `⛓ ${e.flow.length}`))),
      el('div', { class: 'endpoint-body' },
        el('p', { class: 'mb-3' }, m?.summary ? m.summary : noText(), m ? badge(m) : null, ' ', el('span', { class: 'text-body-secondary small' }, code(`line ${e.line}`))),
        el('div', { class: 'row g-3' },
          el('div', { class: 'col-md-5' }, el('div', { class: 'lane lane-front' }, el('div', { class: 'lane-title' }, '🖥️ Called from (front end)'),
            e.callers.length ? el('ul', { class: 'list-unstyled mb-0' }, e.callers.map(c => el('li', { class: 'mb-1' }, el('span', { class: 'step step-front' }, classLink(c.class, `${classById.get(c.class)?.name ?? c.class}.${c.member}`)))))
              : el('span', { class: 'text-body-secondary fst-italic' }, 'no front-end call found'))),
          el('div', { class: 'col-md-7' }, el('div', { class: 'lane lane-back' }, el('div', { class: 'lane-title' }, '⚙️ Then (back end)'),
            e.flow.length ? flowSteps(e.flow, 1) : el('span', { class: 'text-body-secondary fst-italic' }, 'no calls to other classes found'))))));
  }

  function feature(id) {
    const f = features.find(x => x.id === id);
    if (!f) return notFound();
    const owner = classById.get(f.class);
    const area = tileOf(f.class);
    const cards = [...f.endpoints].sort(byRoute).map(e => endpointCard(f, e));
    const setAll = open => cards.forEach(c => { c.open = open; });
    return [crumbs([{ text: 'All areas', hash: '#/' }, ...(area ? [{ text: area.name, hash: `#/tile/${encodeURIComponent(area.id)}` }] : []), { text: f.name }]),
      el('div', { class: 'banner', style: `--h:${hueOf(f.name)}` },
        el('span', { class: 'avatar avatar-lg' }, initials(f.name)),
        el('div', { class: 'min-w-0' }, el('h1', { class: 'h3 mb-1 text-break' }, f.name), el('div', { class: 'banner-route' }, '/' + f.route),
          owner?.summary ? el('p', { class: 'mb-0 mt-2' }, owner.summary, badge(owner)) : null),
        el('div', { class: 'ms-auto d-flex flex-wrap gap-2 align-self-start' }, verbCounts(f).map(([v, n]) => verbPill(v, n)))),
      el('div', { class: 'toolbar' }, el('h2', { class: 'h5 mb-0' }, plural(f.endpoints.length, 'method', 'methods')),
        el('div', { class: 'ms-auto d-flex gap-2' },
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-primary', onclick: () => setAll(true) }, 'Expand all'),
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', onclick: () => setAll(false) }, 'Collapse all'),
          el('a', { class: 'btn btn-sm btn-outline-dark', href: `#/class/${encodeURIComponent(f.class)}` }, owner ? `Class · ${owner.file.split('/').pop()}:${owner.line}` : 'Class'))),
      cards];
  }

  function classView(id) {
    const c = classById.get(id);
    if (!c) return notFound();
    const t = tileOf(c.id);
    const members = c.members.filter(m => !state.missingOnly || !m.summary);
    return [crumbs([{ text: 'All areas', hash: '#/' }, { text: t.name, hash: `#/tile/${encodeURIComponent(t.id)}` }, { text: c.name }]),
      el('div', { class: 'banner', style: `--h:${hueOf(c.name)}` },
        el('span', { class: 'avatar avatar-lg' }, initials(c.name)),
        el('div', { class: 'min-w-0' }, el('h1', { class: 'h3 mb-1 text-break' }, c.name, ' ', kindPill(c.kind)), el('div', { class: 'banner-route' }, `${c.namespace ? `${c.namespace} · ` : ''}${c.file}:${c.line}`),
          el('p', { class: 'mb-0 mt-2' }, description(c, c.kind), badge(c)))),
      c.signature ? el('p', { class: 'mt-3' }, code(c.signature)) : null,
      toggle(),
      el('ul', { class: 'list-group rowlist mb-3' }, members.map(m => el('li', { class: 'list-group-item', style: `--h:${hueOf(m.name)}` },
        el('div', { class: 'd-flex flex-wrap gap-2 align-items-baseline' }, el('span', { class: 'fw-semibold' }, m.name), kindPill(m.kind),
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
      el('ul', { class: 'list-group rowlist mb-3' }, hits.slice(0, 200).map(h => el('li', { class: 'list-group-item d-flex flex-wrap gap-2 align-items-baseline', style: `--h:${hueOf(h.c.name)}` },
        link(h.text, `#/class/${encodeURIComponent(h.c.id)}`, 'fw-semibold'), kindPill(h.kind),
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
    app.replaceChildren(el('div', { class: 'page' }, body.flat(Infinity).filter(Boolean), el('hr'), footer()));
    window.scrollTo(0, 0);
  }

  search.addEventListener('input', () => { location.hash = search.value.trim() ? `#/search/${encodeURIComponent(search.value.trim())}` : '#/'; });
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/search/')) search.value = ''; render(); });
  document.getElementById('title').textContent = `🌳 Code tree · ${data.root}`;
  render();
})();
