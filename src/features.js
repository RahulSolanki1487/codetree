// Features: each web controller is one feature, with its endpoints, the classes it uses, and the front-end functions that call each endpoint.
// Pure: it reads the classes the scan found and returns the features. Nothing is run and no file is read here.

const WILDCARD = '{}';
const segmentsOf = path => path.split('/').filter(Boolean).map(s => (/^\{.*\}$/.test(s) ? WILDCARD : s.toLowerCase()));

/** The full route of an action: the controller's route (with [controller] filled in) and the action's own path; a path that starts with "/" stands alone. */
export function routeOf(controller, action) {
  const own = action.path ?? '';
  if (own.startsWith('/')) return own.replace(/^\/+/, '');
  const base = (controller.route ?? '').replace(/\[controller\]/gi, controller.name.replace(/Controller$/, '').toLowerCase()).replace(/^\/+/, '');
  return [base, own].filter(Boolean).join('/').replace(/\/+/g, '/').replace(/\/$/, '');
}

/** How well a call's path fits an endpoint's: the number of places the endpoint has a variable where the call has fixed text, or null when they differ. */
function fit(callPath, routePath) {
  const call = segmentsOf(callPath);
  const route = segmentsOf(routePath);
  if (call.length !== route.length) return null;
  let variables = 0;
  for (let i = 0; i < call.length; i++) {
    if (call[i] === route[i]) continue; // the same text, or a variable on both sides
    if (call[i] === WILDCARD || route[i] === WILDCARD) { variables++; continue; }
    return null;
  }
  return variables;
}

const isTest = file => /\.(spec|test)\.[jt]sx?$|(^|\/)__tests__\//.test(file);

/** The endpoints a call may be meant for: those of the right verb that fit best (a fixed "orders/mine" beats a variable "orders/{id}"). */
function bestEndpoints(call, endpoints) {
  const fits = endpoints
    .filter(e => !call.verb || e.verb === call.verb)
    .map(e => ({ e, score: fit(call.path, e.path) }))
    .filter(x => x.score !== null);
  const best = Math.min(...fits.map(x => x.score));
  return fits.filter(x => x.score === best).map(x => x.e);
}

/** The parameters of a constructor (or primary constructor) in a signature, as name → type name: "(IFoo foo, A.B<C> bar)" gives foo → IFoo, bar → B. */
function parametersOf(signature, into) {
  const start = signature.indexOf('(');
  if (start < 0) return;
  let depth = 0;
  let current = '';
  const parts = [];
  for (const ch of signature.slice(start + 1)) {
    if (ch === ')' && depth === 0) break;
    if ('(<['.includes(ch)) depth++;
    if (')>]'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { parts.push(current); current = ''; } else current += ch;
  }
  parts.push(current);
  for (const part of parts) {
    const m = /^\s*(?:\[[^\]]*\]\s*)*([\w.]+)(?:<.*>)?\??\s+(\w+)\s*(?:=.*)?$/s.exec(part);
    if (m) { const type = m[1].split('.').pop(); into.set(m[2], type); into.set('_' + m[2], type); }
  }
}

/** The things a class is given when it is made: name → type name, from its primary constructor and its constructors. */
function dependenciesOf(c, cache) {
  if (!cache.has(c)) {
    const deps = new Map();
    parametersOf(c.signature, deps);
    for (const m of c.members) if (m.kind === 'constructor') parametersOf(m.signature, deps);
    cache.set(c, deps);
  }
  return cache.get(c);
}

/** The class a type name means: the class itself, or for an interface IFoo the class Foo when there is one. */
function classNamed(type, byName) {
  const implementation = /^I[A-Z]/.test(type) ? byName.get(type.slice(1)) : null;
  return [implementation, byName.get(type)].find(c => c && c.kind !== 'interface') ?? byName.get(type);
}

const DEEPEST = 2;

/** What a method hands its work to, as steps { class, member, line, calls }: calls on what the class was given, to methods found in the code; DEEPEST levels down. */
function flowOf(c, member, byName, cache, depth, path) {
  const deps = dependenciesOf(c, cache);
  const steps = [];
  for (const call of member.invokes ?? []) {
    const target = deps.has(call.target) ? classNamed(deps.get(call.target), byName) : null;
    const found = target?.members.find(m => m.name === call.method);
    if (!found || path.has(found)) continue;
    steps.push({ class: target.id, member: found.name, line: found.line, calls: depth > 1 ? flowOf(target, found, byName, cache, depth - 1, new Set([...path, found])) : [] });
  }
  return steps;
}

/** Builds the features from the classes of a scan (each member may have `http`, each class `route`, each front-end member `calls`). */
export function buildFeatures(classes) {
  const byName = new Map();
  for (const c of classes) if (!byName.has(c.name)) byName.set(c.name, c);
  const cache = new Map();
  const controllers = classes.filter(c => c.route !== undefined && c.members.some(m => m.http));

  const features = controllers.map(c => ({
    id: c.id,
    name: c.name,
    route: routeOf(c, { path: '' }),
    class: c.id,
    endpoints: c.members.filter(m => m.http).map(m => ({ verb: m.http.verb, path: routeOf(c, m.http), member: m.name, line: m.line, callers: [], flow: flowOf(c, m, byName, cache, DEEPEST, new Set([m])) })),
  }));

  const all = features.flatMap(f => f.endpoints.map(e => ({ ...e, ref: e })));
  for (const c of classes) {
    if (isTest(c.file)) continue;
    for (const m of c.members) {
      for (const call of m.calls ?? []) {
        for (const endpoint of bestEndpoints(call, all)) {
          if (!endpoint.ref.callers.some(x => x.class === c.id && x.member === m.name)) endpoint.ref.callers.push({ class: c.id, member: m.name, line: m.line });
        }
      }
    }
  }
  return features.sort((a, b) => a.name.localeCompare(b.name));
}
