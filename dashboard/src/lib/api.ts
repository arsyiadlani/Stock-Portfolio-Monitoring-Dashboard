import axios from "axios";
import type { Summary, PerformancePoint, Holding, Transaction, DividendsResponse } from "./types";

const client = axios.create({ baseURL: "/api" });

export const api = {
  getSummary: () => client.get<Summary>("/summary").then((r) => r.data),
  getPerformance: () => client.get<PerformancePoint[]>("/performance").then((r) => r.data),
  getHoldings: () => client.get<Holding[]>("/holdings").then((r) => r.data),
  getTransactions: () => client.get<Transaction[]>("/transactions").then((r) => r.data),
  getDividends: () => client.get<DividendsResponse>("/dividends").then((r) => r.data),
  refreshPrices: () => client.post("/refresh-prices").then((r) => r.data),
};
