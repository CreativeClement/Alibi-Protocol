// Must be first import — polyfills crypto.getRandomValues for tweetnacl/Solana
import 'react-native-get-random-values';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { COLORS } from './src/constants/theme';
import { useLocation } from './src/hooks/useLocation';
import { useWallet } from './src/hooks/useWallet';
import { NavigationScreen } from './src/screens/NavigationScreen';
import { VaultScreen } from './src/screens/VaultScreen';
import { AfterScreen } from './src/screens/AfterScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import { EmergencyScreen } from './src/screens/EmergencyScreen';
import { StealthScreen } from './src/screens/StealthScreen';
import { TabBar } from './src/components/TabBar';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SplashScreen } from './src/components/SplashScreen';

const { height } = Dimensions.get('window');

type AppTab = 'NAVIGATION' | 'VAULT' | 'AFTER' | 'WALLET' | 'STEALTH';

export default function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>('NAVIGATION');
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [booting, setBooting] = useState(true);

  const { location, error: locationError, loading: locationLoading } = useLocation({
    enabled: true,
  });

  const { wallet, connect, disconnect, signTransaction } = useWallet();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevTabRef = useRef<AppTab>(currentTab);

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
  }, []);

  const handleTabChange = useCallback((tabId: string) => {
    if (tabId === currentTab) return;
    // Fade out, switch, fade in
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      prevTabRef.current = tabId as AppTab;
      setCurrentTab(tabId as AppTab);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [currentTab, fadeAnim]);

  const tabs = [
    { id: 'NAVIGATION', label: 'Navigate', icon: 'navigate' as const },
    { id: 'VAULT', label: 'Vault', icon: 'lock-closed' as const },
    { id: 'AFTER', label: 'After', icon: 'shield-checkmark' as const },
    { id: 'WALLET', label: 'Wallet', icon: 'wallet' as const },
    { id: 'STEALTH', label: 'Stealth', icon: 'eye-off' as const },
  ];

  if (booting) {
    return (
      <SafeAreaProvider>
        <View style={styles.container}>
          <ExpoStatusBar style="light" />
          <SplashScreen onFinish={() => setBooting(false)} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (emergencyActive) {
    return (
      <SafeAreaProvider>
        <ErrorBoundary fallbackMessage="Emergency mode encountered an error. Your recording data is safe. Tap retry to resume.">
          <SafeAreaView style={styles.container}>
            <ExpoStatusBar style="light" />
            <EmergencyScreen
              location={location}
              onDeactivate={() => setEmergencyActive(false)}
              walletConnected={wallet.connected}
              walletPublicKey={wallet.publicKey}
              signTransaction={signTransaction}
            />
          </SafeAreaView>
        </ErrorBoundary>
      </SafeAreaProvider>
    );
  }

  const renderScreen = () => {
    switch (currentTab) {
      case 'NAVIGATION':
        return (
          <NavigationScreen
            location={location}
            isLoading={locationLoading}
            error={locationError}
            isNavigating={isNavigating}
            onNavigationChange={setIsNavigating}
            onEmergency={() => setEmergencyActive(true)}
          />
        );
      case 'VAULT':
        return <VaultScreen />;
      case 'AFTER':
        return <AfterScreen location={location} />;
      case 'WALLET':
        return (
          <WalletScreen
            wallet={wallet}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        );
      case 'STEALTH':
        return (
          <StealthScreen
            onEmergency={() => setEmergencyActive(true)}
          />
        );
      default:
        return <NavigationScreen
          location={location}
          isLoading={locationLoading}
          error={locationError}
          isNavigating={isNavigating}
          onNavigationChange={setIsNavigating}
          onEmergency={() => setEmergencyActive(true)}
        />;
    }
  };

  return (
    <SafeAreaProvider>
      <ErrorBoundary fallbackMessage="Alibi Protocol encountered an unexpected error. Your vault data and recordings are safe.">
        <SafeAreaView style={styles.container}>
          <ExpoStatusBar style="light" />
          <Animated.View style={[styles.screenContainer, { opacity: fadeAnim }]}>
            {renderScreen()}
          </Animated.View>
          <TabBar
            tabs={tabs}
            activeTab={currentTab}
            onTabChange={handleTabChange}
          />
        </SafeAreaView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenContainer: {
    flex: 1,
  },
});
