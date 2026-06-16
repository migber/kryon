import { useFlowStore } from '@/src/store/flowStore';
import { colors } from '@/src/theme/colors';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const formatUSD = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

const timeAgo = (timestamp: string) => {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

const exchangeColors: Record<string, string> = {
  Kraken: '#5841D8',
  Binance: '#F0B90B',
  Bybit: '#F7A600',
};

function ExchangeBadge({ exchange }: { exchange: string }) {
  const bg = exchangeColors[exchange] ?? colors.circuit;
  return (
    <View style={{
      backgroundColor: bg,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    }}>
      <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>
        {exchange.toUpperCase()}
      </Text>
    </View>
  );
}

export default function FlowsScreen() {
  const insets = useSafeAreaInsets();
  const trades = useFlowStore((s) => s.trades);
  const wsStatus = useFlowStore((s) => s.wsStatus);
  const isConnected = wsStatus === 'connected';

  // Force re-render every 10s so "time ago" labels stay fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const connectedExchanges = Array.from(new Set(trades.map((t) => t.exchange)));

  return (
    <View style={{ flex: 1, backgroundColor: colors.void }}>

      {/* Header */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 20,
        paddingBottom: 12,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.circuit,
      }}>
        <Text style={{
          color: colors.neon,
          fontSize: 20,
          fontWeight: 'bold',
          letterSpacing: 2,
        }}>
          🌊 FLOWS
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
          {trades.length} whale trades
          {connectedExchanges.length > 0 && ` · ${connectedExchanges.join(', ')}`}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {!isConnected && (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: colors.circuit, fontSize: 13 }}>
              Connecting to exchanges...
            </Text>
          </View>
        )}

        {isConnected && trades.length === 0 && (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: colors.circuit, fontSize: 13 }}>
              Waiting for whale trades {'>'} $10K...
            </Text>
          </View>
        )}

        {trades.map((t) => {
          const isBuy = t.side === 'buy';
          const sideColor = isBuy ? colors.neon : colors.danger;

          return (
            <View
              key={t.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: colors.circuit,
              }}
            >
              {/* Top row: exchange + time */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <ExchangeBadge exchange={t.exchange} />
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {timeAgo(t.timestamp)}
                </Text>
              </View>

              {/* Main row: direction + size + value */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: sideColor, fontWeight: 'bold', fontSize: 15 }}>
                    {isBuy ? '▲ BUY' : '▼ SELL'}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 14 }}>
                    {t.qty.toFixed(4)} BTC
                  </Text>
                </View>
                <Text style={{ color: sideColor, fontWeight: 'bold', fontSize: 16 }}>
                  {formatUSD(t.price * t.qty)}
                </Text>
              </View>

              {/* Bottom row: price */}
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                @ ${t.price.toLocaleString()}
              </Text>
            </View>
          );
        })}

      </ScrollView>
    </View>
  );
}