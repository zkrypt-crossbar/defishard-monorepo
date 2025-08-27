/**
 * Home Screen
 * Main screen for the mobile app
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { mobileSDKService } from '../services/SDKService';

export const HomeScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSDKInitialized, setIsSDKInitialized] = useState(false);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => {
    initializeSDK();
  }, []);

  const initializeSDK = async () => {
    try {
      setIsLoading(true);
      await mobileSDKService.initialize({
        relayerUrl: 'http://localhost:3000',
        websocketUrl: 'ws://localhost:3000',
        debug: true,
      });
      setIsSDKInitialized(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to initialize SDK');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterParty = async () => {
    try {
      setIsLoading(true);
      const result = await mobileSDKService.registerParty();
      setPartyId(result.partyId);
      Alert.alert('Success', `Party registered: ${result.partyId}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to register party');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    try {
      setIsLoading(true);
      const result = await mobileSDKService.createGroup(2, 3, 60);
      setGroupId(result.group.groupId);
      Alert.alert('Success', `Group created: ${result.group.groupId}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create group');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartKeygen = async () => {
    try {
      setIsLoading(true);
      await mobileSDKService.startKeygen(true);
      Alert.alert('Success', 'Keygen started');
    } catch (error) {
      Alert.alert('Error', 'Failed to start keygen');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DeFiShArd Mobile</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          SDK: {isSDKInitialized ? '✅ Initialized' : '❌ Not Initialized'}
        </Text>
        {partyId && (
          <Text style={styles.statusText}>Party ID: {partyId.substring(0, 10)}...</Text>
        )}
        {groupId && (
          <Text style={styles.statusText}>Group ID: {groupId.substring(0, 10)}...</Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, !isSDKInitialized && styles.buttonDisabled]}
          onPress={handleRegisterParty}
          disabled={!isSDKInitialized || isLoading}
        >
          <Text style={styles.buttonText}>Register Party</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, (!partyId || !isSDKInitialized) && styles.buttonDisabled]}
          onPress={handleCreateGroup}
          disabled={!partyId || !isSDKInitialized || isLoading}
        >
          <Text style={styles.buttonText}>Create Group</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, (!groupId || !isSDKInitialized) && styles.buttonDisabled]}
          onPress={handleStartKeygen}
          disabled={!groupId || !isSDKInitialized || isLoading}
        >
          <Text style={styles.buttonText}>Start Keygen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
  buttonContainer: {
    gap: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});
