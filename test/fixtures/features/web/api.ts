export class ApiService {
  constructor(private http: Http) {}
  myOrders() { return this.http.get('/api/orders/mine'); }
  getOrder(id: number) { return this.http.get(`/api/orders/${id}`); }
  place(body: unknown) { return this.http.post('/api/orders', body); }
  paid() { return this.http.post('/api/hooks/paid', {}); }
  other() { return this.http.get('/api/nothing/here'); }
}
export const load = () => fetch('/api/orders/mine?x=1');
