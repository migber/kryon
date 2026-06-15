import { Text, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a14',
      justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#00f0ff', fontSize: 20 }}>Settings ⚙️</Text>
    </View>
  );
}