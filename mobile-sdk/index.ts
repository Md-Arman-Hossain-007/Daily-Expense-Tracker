import axios, { AxiosInstance } from 'axios';

export class BudgetTrackerSDK {
  private api: AxiosInstance;

  constructor(baseURL: string, token?: string) {
    this.api = axios.create({
      baseURL,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
  }

  setToken(token: string) {
    this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // --- Transactions ---
  async getTransactions() {
    const res = await this.api.get('/transactions/');
    return res.data;
  }

  async createTransaction(data: any) {
    const res = await this.api.post('/transactions/', data);
    return res.data;
  }

  async deleteTransaction(id: number) {
    const res = await this.api.delete(`/transactions/${id}`);
    return res.data;
  }

  // --- Summary & Analytics ---
  async getSummary() {
    const res = await this.api.get('/summary/');
    return res.data;
  }

  async getForecast(days: number = 30) {
    const res = await this.api.get(`/analytics/forecast/?days=${days}`);
    return res.data;
  }

  // --- Debts ---
  async getDebts() {
    const res = await this.api.get('/debts/');
    return res.data;
  }
}
