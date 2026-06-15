import { useFlowStore } from '@/src/store/flowStore';
import { useCallback, useEffect, useRef } from 'react';

const WS_URL = 'wss://ws.kraken.com/v2';
const HEARTBEAT_TIMEOUT = 10000;
const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;
const PRICE_UPDATE_INTERVAL = 2000; // only update price every 2 seconds max

export function useKrakenWS() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY);
  const lastPriceUpdate = useRef(0);

  const resetHeartbeat = useCallback(() => {
    clearTimeout(heartbeatTimer.current!);
    heartbeatTimer.current = setTimeout(() => {
      console.warn('💔 Heartbeat timeout — forcing reconnect');
      ws.current?.close();
    }, HEARTBEAT_TIMEOUT);
  }, []);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    useFlowStore.getState().setWsStatus('connecting');
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      reconnectDelay.current = INITIAL_RECONNECT_DELAY;
      useFlowStore.getState().setWsStatus('connected');
      resetHeartbeat();

      ws.current?.send(JSON.stringify({
        method: 'subscribe',
        params: { channel: 'ticker', symbol: ['BTC/USD'] }
      }));

      ws.current?.send(JSON.stringify({
        method: 'subscribe',
        params: { channel: 'trade', symbol: ['BTC/USD'] }
      }));

      ws.current?.send(JSON.stringify({
        method: 'subscribe',
        params: { channel: 'book', symbol: ['BTC/USD'], depth: 10 }
      }));
    };

    ws.current.onmessage = (event) => {
      resetHeartbeat();
      const data = JSON.parse(event.data);
      const { addTrade, updateOrderBook, setCurrentPrice, whaleThreshold } =
        useFlowStore.getState();

      // Throttle price updates — only every 2 seconds
      if (data.channel === 'ticker' && data.type === 'update') {
        const now = Date.now();
        if (now - lastPriceUpdate.current >= PRICE_UPDATE_INTERVAL) {
          const ticker = data.data[0];
          if (ticker?.last) {
            setCurrentPrice(ticker.last);
            lastPriceUpdate.current = now;
          }
        }
      }

      if (data.channel === 'trade' && data.type === 'update') {
        data.data.forEach((trade: any) => {
          const valueUSD = trade.price * trade.qty;
          if (valueUSD < whaleThreshold) return;
          addTrade({
            id: `${trade.timestamp}-${Math.random()}`,
            price: trade.price,
            qty: trade.qty,
            side: trade.side,
            timestamp: trade.timestamp,
            exchange: 'Kraken',
          });
        });
      }

      if (data.channel === 'book' &&
        (data.type === 'snapshot' || data.type === 'update')) {
        updateOrderBook({
          bids: data.data[0].bids,
          asks: data.data[0].asks,
          type: data.type,
        });
      }
    };

    ws.current.onerror = (e) => {
      ws.current?.close();
    };

    ws.current.onclose = () => {
      clearTimeout(heartbeatTimer.current!);
      useFlowStore.getState().setWsStatus('reconnecting');
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(
          reconnectDelay.current * 2,
          MAX_RECONNECT_DELAY
        );
        connect();
      }, reconnectDelay.current);
    };
  }, [resetHeartbeat]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current!);
      clearTimeout(heartbeatTimer.current!);
      ws.current?.close();
    };
  }, [connect]);
}