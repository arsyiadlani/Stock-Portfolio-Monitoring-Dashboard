export interface Summary {
  total_invested: number;   // net cash deployed (BUY - SELL proceeds)
  total_buy: number;        // gross cumulative BUY spend (denominator for return%)
  current_value: number;    // market value of current holdings
  unrealized_pnl: number;
  realized_pnl: number;
  total_return_pct: number;
  ihsg_return_pct: number;
  alpha: number;
  portfolio_cagr: number;
  ihsg_cagr: number;
  dividend_total: number;
  sharpe_ratio: number;
  sharpe_ratio_div: number;
  max_drawdown_pct: number;
  max_drawdown_pct_div: number;
  ihsg_sharpe: number;
  ihsg_max_drawdown_pct: number;
  data_as_of: string | null;
}

export interface DividendEvent {
  date: string;
  ticker: string;
  lots: number;
  shares: number;
  per_share: number;
  total_received: number;
}

export interface DividendsResponse {
  events: DividendEvent[];
  total: number;
}

export interface PerformancePoint {
  date: string;
  portfolio_value: number;
  total_invested: number;
  portfolio_return_pct: number;
  portfolio_return_pct_div: number;
  ihsg_return_pct: number | null;
}

export interface Holding {
  ticker: string;
  lots: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  pnl_pct: number;
}

export interface Transaction {
  date: string;
  ticker: string;
  action: "BUY" | "SELL";
  price: number;
  lots: number;
  total_spend: number;
}
