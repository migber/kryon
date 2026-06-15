import { create } from 'zustand';

export type Trade = {
  id: string;
  price: number;
  qty: number;
  side: 'buy' | 'sell';
  timestamp: string;
  exchange: string;
};

export type FlowBucket = {
  timestamp: number;
  buyVolume: number;
  sellVolume: number;
  netFlow: number;
  tradeCount: number;
  largestTrade: number;
  cvd: number;
};

export type OrderBookLevel = {
  price: number;
  qty: number;
};

export type OrderBook = {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
};

export type SpoofAlert = {
  id: string;
  side: 'bid' | 'ask';
  price: number;
  qty: number;
  valueUSD: number;
  detectedAt: number;
};

type FlowStore = {
  trades: Trade[];
  buckets: FlowBucket[];
  currentPrice: number;
  cvd: number;
  netFlow: number;
  orderBook: OrderBook;
  previousOrderBook: OrderBook;
  spoofAlerts: SpoofAlert[];
  whaleThreshold: number;
  wsStatus: 'connecting' | 'connected' | 'reconnecting' | 'error';

  addTrade: (trade: Trade) => void;
  clearTrades: () => void;
  updateOrderBook: (data: { bids: any[]; asks: any[]; type: string }) => void;
  setWhaleThreshold: (amount: number) => void;
  setWsStatus: (status: 'connecting' | 'connected' | 'reconnecting' | 'error') => void;
  setCurrentPrice: (price: number) => void;
};

const getCurrentMinuteBucket = (): number => {
  const now = Date.now();
  return now - (now % 60000);
};

export const useFlowStore = create<FlowStore>((set) => ({
  trades: [],
  buckets: [],
  currentPrice: 0,
  cvd: 0,
  netFlow: 0,
  orderBook: { bids: [], asks: [] },
  previousOrderBook: { bids: [], asks: [] },
  spoofAlerts: [],
  whaleThreshold: 10_000,
  wsStatus: 'connecting',

  setCurrentPrice: (price) => set({ currentPrice: price }),

  setWsStatus: (status) => set({ wsStatus: status }),

  setWhaleThreshold: (amount) => set({ whaleThreshold: amount }),

  addTrade: (trade) => set((state) => {
    const trades = [trade, ...state.trades].slice(0, 200);
    const tradeValue = trade.price * trade.qty;
    const isBuy = trade.side === 'buy';

    const cvd = state.cvd + (isBuy ? tradeValue : -tradeValue);

    const netFlow = trades.reduce((acc, t) => {
      const value = t.price * t.qty;
      return t.side === 'buy' ? acc + value : acc - value;
    }, 0);

    const bucketTs = getCurrentMinuteBucket();
    const buckets = [...state.buckets];
    const existingIndex = buckets.findIndex(b => b.timestamp === bucketTs);

    if (existingIndex >= 0) {
      const b = buckets[existingIndex];
      buckets[existingIndex] = {
        ...b,
        buyVolume: isBuy ? b.buyVolume + tradeValue : b.buyVolume,
        sellVolume: !isBuy ? b.sellVolume + tradeValue : b.sellVolume,
        netFlow: b.netFlow + (isBuy ? tradeValue : -tradeValue),
        tradeCount: b.tradeCount + 1,
        largestTrade: Math.max(b.largestTrade, tradeValue),
        cvd,
      };
    } else {
      buckets.push({
        timestamp: bucketTs,
        buyVolume: isBuy ? tradeValue : 0,
        sellVolume: !isBuy ? tradeValue : 0,
        netFlow: isBuy ? tradeValue : -tradeValue,
        tradeCount: 1,
        largestTrade: tradeValue,
        cvd,
      });
    }

    return {
      trades,
      cvd,
      netFlow,
      // don't update price here anymore — ticker handles it
      buckets: buckets.slice(-60),
    };
  }),

  clearTrades: () => set({
    trades: [],
    buckets: [],
    cvd: 0,
    netFlow: 0,
    currentPrice: 0,
  }),

  updateOrderBook: (data) => set((state) => {
    const SPOOF_THRESHOLD_BTC = 1.0;
    const newAlerts: SpoofAlert[] = [];

    if (data.type === 'snapshot') {
      const orderBook = {
        bids: data.bids.map((b: any) => ({ price: b.price, qty: b.qty })),
        asks: data.asks.map((a: any) => ({ price: a.price, qty: a.qty })),
      };
      return { orderBook, previousOrderBook: orderBook };
    }

    if (data.type === 'update') {
      const currentPrice = state.currentPrice;

      data.bids.forEach((bid: any) => {
        if (bid.qty === 0) {
          const prev = state.orderBook.bids.find(b => b.price === bid.price);
          if (prev && prev.qty >= SPOOF_THRESHOLD_BTC) {
            newAlerts.push({
              id: `spoof-bid-${bid.price}-${Date.now()}`,
              side: 'bid',
              price: bid.price,
              qty: prev.qty,
              valueUSD: prev.qty * currentPrice,
              detectedAt: Date.now(),
            });
          }
        }
      });

      data.asks.forEach((ask: any) => {
        if (ask.qty === 0) {
          const prev = state.orderBook.asks.find(a => a.price === ask.price);
          if (prev && prev.qty >= SPOOF_THRESHOLD_BTC) {
            newAlerts.push({
              id: `spoof-ask-${ask.price}-${Date.now()}`,
              side: 'ask',
              price: ask.price,
              qty: prev.qty,
              valueUSD: prev.qty * currentPrice,
              detectedAt: Date.now(),
            });
          }
        }
      });

      const mergeLevels = (
        current: OrderBookLevel[],
        updates: any[]
      ): OrderBookLevel[] => {
        const map = new Map(current.map(l => [l.price, l.qty]));
        updates.forEach((u: any) => {
          if (u.qty === 0) map.delete(u.price);
          else map.set(u.price, u.qty);
        });
        return Array.from(map.entries()).map(([price, qty]) => ({ price, qty }));
      };

      const orderBook = {
        bids: mergeLevels(state.orderBook.bids, data.bids)
          .sort((a, b) => b.price - a.price)
          .slice(0, 10),
        asks: mergeLevels(state.orderBook.asks, data.asks)
          .sort((a, b) => a.price - b.price)
          .slice(0, 10),
      };

      return {
        orderBook,
        previousOrderBook: state.orderBook,
        spoofAlerts: [...newAlerts, ...state.spoofAlerts].slice(0, 20),
      };
    }

    return {};
  }),
}));