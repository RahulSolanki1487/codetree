// The viewer's script. It runs in the browser from the one HTML file, reads the tree embedded in that file and nothing else, and draws only with textContent
// (no innerHTML), so no text from the scanned code is ever treated as markup.
(function () {
  const data = JSON.parse(document.getElementById('codetree-data').textContent);
  const app = document.getElementById('app');
  const search = document.getElementById('search');
  const classById = new Map(data.classes.map(c => [c.id, c]));
  const ORDER = ['class', 'interface', 'struct', 'record', 'enum', 'module'];
  const state = { missingOnly: false };

  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return node;
  }
  const link = (text, hash, cls) => el('a', { href: hash, class: cls }, text);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const noText = () => el('span', { class: 'none' }, 'no description yet');
  const description = (item, kind) => (kind === 'module' ? el('span', { class: 'none' }, 'the functions of this file') : item.summary ? el('span', null, item.summary) : noText());
  const badge = item => (item.generated ? el('span', { class: 'badge', title: 'Written by an agent: read it, then keep it with: codetree describe --accept' }, 'generated') : null);

  function counts(c) {
    const missing = c.members.filter(m => !m.summary).length + (c.summary || c.kind === 'module' ? 0 : 1);
    return { members: c.members.length, missing };
  }

  function crumbs(parts) {
    return el('nav', { class: 'crumbs', 'aria-label': 'Where you are' }, parts.flatMap((p, i) => [i ? el('span', { 'aria-hidden': 'true' }, ' › ') : null, p.hash ? link(p.text, p.hash) : el('strong', null, p.text)]));
  }

  function toggle() {
    return el('label', { class: 'toggle' }, el('input', { type: 'checkbox', checked: state.missingOnly, onchange: e => { state.missingOnly = e.target.checked; render(); } }), ' Show only what has no description');
  }

  function home() {
    const total = data.classes.length;
    const missing = data.classes.reduce((n, c) => n + counts(c).missing, 0);
    return [
      el('p', { class: 'lead' }, `${plural(data.tiles.length, 'area', 'areas')}, ${plural(total, 'class or file', 'classes and files')}, ${plural(missing, 'item has', 'items have')} no description yet.`),
      el('div', { class: 'grid' }, data.tiles.map(t => {
        const classes = t.classes.map(id => classById.get(id));
        const m = classes.reduce((n, c) => n + counts(c).members, 0);
        const gap = classes.reduce((n, c) => n + counts(c).missing, 0);
        return el('a', { class: 'tile', href: `#/tile/${encodeURIComponent(t.id)}` }, el('h2', null, t.name), el('p', null, `${plural(classes.length, 'class or file', 'classes and files')} · ${plural(m, 'member', 'members')}`), el('p', { class: gap ? 'gap' : 'ok' }, gap ? `${gap} without a description` : 'all described'));
      })),
    ];
  }

  function tile(id) {
    const t = data.tiles.find(x => x.id === id);
    if (!t) return notFound();
    const classes = t.classes.map(i => classById.get(i)).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.name.localeCompare(b.name));
    const shown = classes.filter(c => !state.missingOnly || counts(c).missing > 0);
    return [crumbs([{ text: 'All areas', hash: '#/' }, { text: t.name }]), toggle(),
      el('ul', { class: 'rows' }, shown.map(c => el('li', null, link(c.name, `#/class/${encodeURIComponent(c.id)}`, 'name'), el('span', { class: 'kind' }, c.kind), el('span', { class: 'what' }, description(c, c.kind), badge(c)), el('span', { class: 'meta' }, plural(c.members.length, 'member', 'members'))))),
      shown.length ? null : el('p', { class: 'none' }, 'Nothing to show.')];
  }

  function classView(id) {
    const c = classById.get(id);
    if (!c) return notFound();
    const t = data.tiles.find(x => x.classes.includes(c.id));
    const members = c.members.filter(m => !state.missingOnly || !m.summary);
    return [crumbs([{ text: 'All areas', hash: '#/' }, { text: t.name, hash: `#/tile/${encodeURIComponent(t.id)}` }, { text: c.name }]),
      el('p', { class: 'where' }, el('span', { class: 'kind' }, c.kind), c.namespace ? ` ${c.namespace} · ` : ' ', el('code', null, `${c.file}:${c.line}`)),
      c.signature ? el('p', null, el('code', null, c.signature)) : null,
      el('p', { class: 'lead' }, description(c, c.kind), badge(c)),
      toggle(),
      el('ul', { class: 'rows members' }, members.map(m => el('li', null, el('span', { class: 'name' }, m.name), el('span', { class: 'kind' }, m.kind), el('span', { class: 'what' }, description(m), badge(m), el('br'), el('code', null, m.signature)), el('span', { class: 'meta' }, el('code', null, `${m.file ?? c.file}:${m.line}`))))),
      members.length ? null : el('p', { class: 'none' }, 'Nothing to show.')];
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
      el('p', { class: 'lead' }, `${plural(hits.length, 'result', 'results')}${hits.length > 200 ? ', the first 200 shown' : ''}.`),
      el('ul', { class: 'rows' }, hits.slice(0, 200).map(h => el('li', null, link(h.text, `#/class/${encodeURIComponent(h.c.id)}`, 'name'), el('span', { class: 'kind' }, h.kind), el('span', { class: 'what' }, h.summary || noText()), el('span', { class: 'meta' }, el('code', null, `${h.c.file}:${h.line}`)))))];
  }

  function notFound() { return [el('p', { class: 'none' }, 'That is not in this tree.'), link('Back to all areas', '#/')]; }

  function footer() {
    const langs = Object.entries(data.skipped.languages);
    const notes = [];
    if (langs.length) notes.push(`Skipped files in unsupported languages: ${langs.map(([l, n]) => `${l} ${n}`).join(', ')}.`);
    if (data.skipped.generated) notes.push(`Skipped ${plural(data.skipped.generated, 'generated or minified file', 'generated or minified files')}.`);
    if (data.skipped.ignored) notes.push(`Left out ${plural(data.skipped.ignored, 'file or folder', 'files and folders')} that the project's .gitignore ignores.`);
    if (data.skipped.tooBig) notes.push(`Skipped ${plural(data.skipped.tooBig, 'file', 'files')} over 1 MB.`);
    return notes.map(n => el('p', { class: 'skipped' }, n));
  }

  function render() {
    const [kind, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
    const value = decodeURIComponent(rest.join('/'));
    const body = kind === 'tile' ? tile(value) : kind === 'class' ? classView(value) : kind === 'search' ? results(value) : home();
    app.replaceChildren(...body.flat().filter(Boolean), ...footer());
    window.scrollTo(0, 0);
  }

  search.addEventListener('input', () => { location.hash = search.value.trim() ? `#/search/${encodeURIComponent(search.value.trim())}` : '#/'; });
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/search/')) search.value = ''; render(); });
  document.getElementById('title').textContent = `Code tree · ${data.root}`;
  render();
})();
