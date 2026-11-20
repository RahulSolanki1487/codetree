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

/** The classes a controller takes in (its constructor parameters, read from its signature), by name, other than itself. */
function usedBy(controller, byName) {
  const names = new Set(controller.signature.match(/\b[A-Z]\w*/g) ?? []);
  return [...names].map(n => byName.get(n)).filter(c => c && c !== controller && c.kind !== 'enum').map(c => c.id);
}

/** Builds the features from the classes of a scan (each member may have `http`, each class `route`, each front-end member `calls`). */
export function buildFeatures(classes) {
  const byName = new Map();
  for (const c of classes) if (!byName.has(c.name)) byName.set(c.name, c);
  const controllers = classes.filter(c => c.route !== undefined && c.members.some(m => m.http));

  const features = controllers.map(c => ({
    id: c.id,
    name: c.name.replace(/Controller$/, ''),
    route: routeOf(c, { path: '' }),
    class: c.id,
    uses: usedBy(c, byName),
    endpoints: c.members.filter(m => m.http).map(m => ({ verb: m.http.verb, path: routeOf(c, m.http), member: m.name, line: m.line, callers: [] })),
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
