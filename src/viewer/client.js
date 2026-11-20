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
  const joined = nodes => nodes.flatMap((n, i) => [i ? ', ' : null, n]);

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

  // The areas are filters: the one chosen (or "All") decides what the list below the tiles shows.
  function areaCard(href, title, lines, selected) {
    return el('div', { class: 'col' }, el('a', { href, class: `card h-100 text-decoration-none ${selected ? 'border-primary border-2 shadow-sm' : ''}`, 'aria-current': selected ? 'true' : null },
      el('div', { class: 'card-body' }, el('h2', { class: 'h5 card-title text-body' }, title), lines.map(l => el('p', { class: `card-text mb-1 small ${l.cls ?? 'text-body-secondary'}` }, l.text)))));
  }

  function overview(selectedId) {
    const selected = selectedId ? data.tiles.find(x => x.id === selectedId) : null;
    if (selectedId && !selected) return notFound();
    const totalMissing = data.classes.reduce((n, c) => n + counts(c).missing, 0);
    const cards = [areaCard('#/', 'All', [{ text: `${plural(data.classes.length, 'class or file', 'classes and files')}` }, { text: `${plural(features.length, 'feature', 'features')}` },
      { text: totalMissing ? `${totalMissing} without a description` : 'all described', cls: totalMissing ? 'text-warning-emphasis' : 'text-success' }], !selected)];
    for (const t of data.tiles) {
      const classes = t.classes.map(id => classById.get(id));
      const members = classes.reduce((n, c) => n + counts(c).members, 0);
      const gap = classes.reduce((n, c) => n + counts(c).missing, 0);
      const own = features.filter(f => t.classes.includes(f.class));
      cards.push(areaCard(`#/tile/${encodeURIComponent(t.id)}`, t.name, [
        { text: `${plural(classes.length, 'class or file', 'classes and files')} · ${plural(members, 'member', 'members')}` },
        ...(own.length ? [{ text: plural(own.length, 'feature', 'features') }] : []),
        { text: gap ? `${gap} without a description` : 'all described', cls: gap ? 'text-warning-emphasis' : 'text-success' }], selected?.id === t.id));
    }

    const shownFeatures = selected ? features.filter(f => selected.classes.includes(f.class)) : features;
    const out = [el('div', { class: 'row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3 mb-4' }, cards)];
    if (shownFeatures.length) out.push(featureList(shownFeatures, selected ? `${selected.name}: features` : 'Features (one per controller)'));
    if (selected) out.push(classList(selected, shownFeatures.length > 0));
    else if (!shownFeatures.length) out.push(el('p', { class: 'text-body-secondary' }, 'Choose an area to see its classes and files.'));
    return out;
  }

  function featureList(list, title) {
    return el('section', { class: 'mb-4' }, el('h2', { class: 'h5 mb-1' }, title),
      el('p', { class: 'text-body-secondary small' }, 'Each controller with the calls it answers and the front-end functions that call them.'),
      list.map(f => {
        const owner = classById.get(f.class);
        const endpoints = [...f.endpoints].sort((a, b) => a.path.localeCompare(b.path) || VERB_ORDER.indexOf(a.verb) - VERB_ORDER.indexOf(b.verb));
        return el('details', { class: 'card mb-2' },
          el('summary', { class: 'card-header d-flex flex-wrap gap-2 align-items-center' }, el('strong', null, f.name), code(`/${f.route}`),
            el('span', { class: 'badge text-bg-secondary ms-auto' }, plural(f.endpoints.length, 'endpoint', 'endpoints'))),
          el('div', { class: 'card-body py-2' },
            owner?.summary ? el('p', { class: 'mb-1' }, owner.summary, badge(owner)) : null,
            el('p', { class: 'small mb-2' }, classLink(f.class, 'Controller'), ' · ', link('Open this feature', `#/feature/${encodeURIComponent(f.id)}`))),
          endpointRows(f, endpoints));
      }));
  }

  function endpointRows(f, endpoints) {
    const owner = classById.get(f.class);
    return el('ul', { class: 'list-group list-group-flush' }, endpoints.map(e => {
      const m = owner?.members.find(x => x.name === e.member && x.line === e.line) ?? owner?.members.find(x => x.name === e.member);
      return el('li', { class: 'list-group-item' },
        el('div', { class: 'd-flex flex-wrap align-items-baseline gap-1' }, verbBadge(e.verb), code(`/${e.path}`), el('span', { class: 'text-body-secondary small ms-2' }, e.member)),
        el('div', { class: 'small' }, m?.summary ? m.summary : noText(), m ? badge(m) : null),
        el('div', { class: 'small text-body-secondary' }, e.callers.length
          ? ['Called from: ', joined(e.callers.map(c => classLink(c.class, `${classById.get(c.class)?.name ?? c.class}.${c.member}`)))]
          : el('span', { class: 'fst-italic' }, 'no front-end call found')));
    }));
  }

  function classList(t, collapsed) {
    const classes = t.classes.map(i => classById.get(i)).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.name.localeCompare(b.name));
    const shown = classes.filter(c => !state.missingOnly || counts(c).missing > 0);
    const body = [toggle(),
      el('ul', { class: 'list-group mb-3' }, shown.map(c => el('li', { class: 'list-group-item d-flex flex-wrap gap-2 align-items-baseline' },
        link(c.name, `#/class/${encodeURIComponent(c.id)}`, 'fw-semibold'), el('span', { class: 'badge text-bg-light border' }, c.kind),
        el('span', { class: 'flex-grow-1' }, description(c, c.kind), badge(c)), el('span', { class: 'text-body-secondary small' }, plural(c.members.length, 'member', 'members'))))),
      shown.length ? null : el('p', { class: 'text-body-secondary fst-italic' }, 'Nothing to show.')];
    const title = `${t.name}: ${plural(classes.length, 'class or file', 'classes and files')}`;
    return collapsed
      ? el('details', { class: 'mb-4' }, el('summary', { class: 'h5 mb-3' }, title), body)
      : el('section', { class: 'mb-4' }, el('h2', { class: 'h5' }, title), body);
  }

  function feature(id) {
    const f = features.find(x => x.id === id);
    if (!f) return notFound();
    const owner = classById.get(f.class);
    const t = tileOf(f.class);
    const endpoints = [...f.endpoints].sort((a, b) => a.path.localeCompare(b.path) || VERB_ORDER.indexOf(a.verb) - VERB_ORDER.indexOf(b.verb));
    return [crumbs([{ text: 'All areas', hash: '#/' }, ...(t ? [{ text: t.name, hash: `#/tile/${encodeURIComponent(t.id)}` }] : []), { text: f.name }]),
      el('h1', { class: 'h3' }, f.name),
      el('p', null, code(`/${f.route}`), ' · handled by ', classLink(f.class), owner ? [' ', code(`${owner.file}:${owner.line}`)] : null),
      owner?.summary ? el('p', { class: 'lead' }, owner.summary, badge(owner)) : null,
      f.uses.length ? el('p', null, 'Uses: ', joined(f.uses.map(u => classLink(u)))) : null,
      el('div', { class: 'card' }, endpointRows(f, endpoints))];
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
    const body = kind === 'tile' ? overview(value) : kind === 'class' ? classView(value) : kind === 'feature' ? feature(value) : kind === 'search' ? results(value) : overview(null);
    app.replaceChildren(...body.flat().filter(Boolean), el('hr'), ...footer());
    window.scrollTo(0, 0);
  }

  search.addEventListener('input', () => { location.hash = search.value.trim() ? `#/search/${encodeURIComponent(search.value.trim())}` : '#/'; });
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/search/')) search.value = ''; render(); });
  document.getElementById('title').textContent = `Code tree · ${data.root}`;
  render();
})();
