import { useFlowStore } from '@/src/store/flowStore';
import { colors, wsLabels } from '@/src/theme/colors';
import { useEffect, useRef } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const formatUSD = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

function StatusDot({ status }: { status: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    animation.current?.stop();
    pulse.setValue(1);

    if (status === 'connected') {
      animation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      animation.current.start();
    } else if (status === 'reconnecting') {
      animation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.2, duration: 300, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 300, useNativeDriver: true }),
        ])
      );
      animation.current.start();
    }

    return () => animation.current?.stop();
  }, [status]);

  const color = colors.wsStatus[status as keyof typeof colors.wsStatus] ?? colors.textMuted;
  const label = wsLabels[status] ?? 'UNKNOWN';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Animated.View style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        opacity: pulse,
      }} />
      <Text style={{ color, fontSize: 11, fontWeight: '600', letterSpacing: 1 }}>
        {label}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const currentPrice = useFlowStore((s) => s.currentPrice);
  const cvd = useFlowStore((s) => s.cvd);
  const trades = useFlowStore((s) => s.trades);
  const buckets = useFlowStore((s) => s.buckets);
  const wsStatus = useFlowStore((s) => s.wsStatus);

  const currentBucket = buckets[buckets.length - 1];
  const cvdColor = cvd > 0 ? colors.neon : colors.danger;
  const signal = cvd > 0 ? '🟢 INFLOW' : '🔴 OUTFLOW';
  const isConnected = wsStatus === 'connected';
  const hasPrice = currentPrice > 0;

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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <View>
          <Text style={{
            color: colors.neon,
            fontSize: 20,
            fontWeight: 'bold',
            letterSpacing: 2,
          }}>
            ⚡ KRYON
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 10 }}>
            BTC Smart Money Tracker
          </Text>
        </View>
        <StatusDot status={wsStatus} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>

        {/* BTC Price */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.circuit,
        }}>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>
            BTC / USD
          </Text>
          <Text style={{ color: colors.text, fontSize: 36, fontWeight: 'bold' }}>
            {hasPrice ? `$${currentPrice.toLocaleString()}` : '---'}
          </Text>
          {!hasPrice && (
            <Text style={{ color: colors.circuit, fontSize: 12, marginTop: 4 }}>
              Waiting for ticker...
            </Text>
          )}
        </View>

        {/* CVD Signal Hero */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: isConnected ? (cvd > 0 ? colors.neon : colors.danger) : colors.circuit,
        }}>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>
            CUMULATIVE VOLUME DELTA
          </Text>
          <Text style={{
            color: isConnected ? cvdColor : colors.circuit,
            fontSize: 32,
            fontWeight: 'bold',
          }}>
            {isConnected ? formatUSD(cvd) : '---'}
          </Text>
          <Text style={{
            color: isConnected ? cvdColor : colors.circuit,
            fontSize: 14,
            marginTop: 4,
          }}>
            {isConnected ? signal : 'Waiting for data...'}
          </Text>
        </View>

        {/* Minute Bucket Stats */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.circuit,
        }}>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 12 }}>
            THIS MINUTE
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {[
              { label: 'BUY VOL', value: currentBucket ? formatUSD(currentBucket.buyVolume) : '---', color: colors.neon },
              { label: 'SELL VOL', value: currentBucket ? formatUSD(currentBucket.sellVolume) : '---', color: colors.danger },
              { label: 'TRADES', value: currentBucket ? `${currentBucket.tradeCount}` : '---', color: colors.text },
              { label: 'LARGEST', value: currentBucket ? formatUSD(currentBucket.largestTrade) : '---', color: colors.text },
            ].map((stat) => (
              <View key={stat.label}>
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>{stat.label}</Text>
                <Text style={{ color: stat.color, fontSize: 18, fontWeight: 'bold' }}>
                  {stat.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Whale Trades */}
        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>
          🐋 WHALE TRADES
        </Text>
        {!isConnected && (
          <Text style={{ color: colors.circuit, fontSize: 13 }}>
            Connecting to Kraken...
          </Text>
        )}
        {isConnected && trades.length === 0 && (
          <Text style={{ color: colors.circuit, fontSize: 13 }}>
            Waiting for whale trades {'>'} $10K...
          </Text>
        )}
        {trades.map((t) => (
          <View key={t.id} style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.circuit,
          }}>
            <Text style={{
              color: t.side === 'buy' ? colors.neon : colors.danger,
              fontWeight: 'bold',
              fontSize: 13,
            }}>
              {t.side === 'buy' ? '▲ BUY' : '▼ SELL'}
            </Text>
            <Text style={{ color: colors.text, fontSize: 13 }}>
              {t.qty.toFixed(4)} BTC
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              ${t.price.toLocaleString()}
            </Text>
            <Text style={{
              color: t.side === 'buy' ? colors.neon : colors.danger,
              fontSize: 13,
            }}>
              {formatUSD(t.price * t.qty)}
            </Text>
          </View>
        ))}

      </ScrollView>
    </View>
  );
}