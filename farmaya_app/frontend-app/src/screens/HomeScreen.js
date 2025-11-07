import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';

import API from '../api/api';

const ORDER_STEPS = [
  { key: 'creado', label: 'Pedido creado' },
  { key: 'aceptado', label: 'Pedido aceptado' },
  { key: 'en_camino', label: 'En camino' },
  { key: 'recibido', label: 'Recibido' },
];

const normalizeStatus = (status) => (status === 'aprobado' ? 'aceptado' : status);

export default function HomeScreen({ navigation }) {
  const [displayName, setDisplayName] = useState('Usuario');
  const [uploading, setUploading] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [ordersCount, setOrdersCount] = useState(0);

  const loadOrders = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('clienteOrders');
      if (!stored) {
        setActiveOrder(null);
        setOrdersCount(0);
        return;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        setActiveOrder(null);
        setOrdersCount(0);
        return;
      }

      const sorted = parsed
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.fecha || 0) - new Date(a.createdAt || a.fecha || 0)
        );

      setOrdersCount(sorted.length);
      const running = sorted.find((order) => normalizeStatus(order.estado) !== 'recibido');
      setActiveOrder(running || null);
    } catch (error) {
      console.error('Error cargando pedidos del cliente:', error);
      setActiveOrder(null);
      setOrdersCount(0);
    }
  }, []);

  useEffect(() => {
    const loadUserAndConfigureHeader = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        let name = 'Usuario';
        if (stored) {
          const user = JSON.parse(stored);
          name = user.nombre || (user.email ? user.email.split('@')[0] : 'Usuario');
        }
        setDisplayName(name);

        navigation.setOptions({
          headerTitle: () => <Text style={styles.headerTitle}>Hola, {name}</Text>,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              style={styles.headerProfileButton}
            >
              <Text style={styles.profileIcon}>👤</Text>
            </TouchableOpacity>
          ),
        });
      } catch (error) {
        console.error('Error cargando usuario:', error);
      }
    };

    loadUserAndConfigureHeader();
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        Alert.alert('Cancelado', 'No seleccionaste ningún archivo.');
        return;
      }

      const file = result.assets[0];
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert('Sesión expirada', 'Por favor, inicia sesión nuevamente.');
        return;
      }

      const formData = new FormData();
      formData.append('imagen', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      });

      setUploading(true);

      const response = await API.post('accounts/recetas/', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploading(false);
      Alert.alert('✅ Receta subida', 'Tu receta fue enviada correctamente.');
      console.log('Respuesta backend:', response.data);
    } catch (error) {
      setUploading(false);
      console.error('Error al subir receta:', error.response?.data || error);
      Alert.alert('Error', 'No se pudo subir la receta.');
    }
  };

  if (uploading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E88E5" />
        <Text>Subiendo receta...</Text>
      </View>
    );
  }

  const activeStatus = normalizeStatus(activeOrder?.estado);
  const currentStepIndex = activeStatus
    ? Math.max(ORDER_STEPS.findIndex((step) => step.key === activeStatus), 0)
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Seguimiento de tu pedido</Text>
          {activeOrder ? (
            <>
              <Text style={styles.progressSubtitle}>
                {activeOrder.productoNombre || activeOrder.producto_nombre || 'Pedido'} ·{' '}
                {activeOrder.farmaciaNombre || activeOrder.farmacia || 'Farmacia'}
              </Text>
              <View style={styles.stepsWrapper}>
                {ORDER_STEPS.map((step, index) => {
                  const isCompleted = index < currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  return (
                    <View key={step.key} style={styles.stepItem}>
                      <View style={styles.stepRow}>
                        <View
                          style={[
                            styles.stepCircle,
                            isCompleted && styles.stepCircleCompleted,
                            isCurrent && styles.stepCircleCurrent,
                          ]}
                        >
                          <Text
                            style={[
                              styles.stepCircleText,
                              (isCompleted || isCurrent) && styles.stepCircleTextActive,
                            ]}
                          >
                            {isCompleted ? '✓' : index + 1}
                          </Text>
                        </View>
                        {index < ORDER_STEPS.length - 1 && (
                          <View
                            style={[
                              styles.stepConnector,
                              index < currentStepIndex
                                ? styles.stepConnectorActive
                                : styles.stepConnectorInactive,
                            ]}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepLabel,
                          (isCompleted || isCurrent) && styles.stepLabelActive,
                        ]}
                      >
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.progressPlaceholder}>
              Cuando confirmes una compra vas a poder seguirla desde aquí.
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.uploadButton} onPress={handleUpload}>
          <Text style={styles.uploadIcon}>📤</Text>
          <Text style={styles.uploadText}>Cargar receta (foto o PDF)</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Acciones rápidas</Text>

        <View style={styles.grid}>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('BuscarFarmacia')}>
            <Text style={styles.cardText}>🔍 Buscar farmacia</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('MisPedidos')}
          >
            <Text style={styles.cardText}>🛒 Mis pedidos</Text>
            {ordersCount > 0 ? (
              <Text style={styles.cardBadge}>
                {ordersCount} {ordersCount === 1 ? 'pedido' : 'pedidos'}
              </Text>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.cardDisabled]}
            onPress={() => Alert.alert('Próximamente', 'Esta función aún no está disponible.')}
          >
            <Text style={styles.cardText}>⏰ Recordatorios</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.footerText}>Inicio</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('BuscarFarmacia')}>
          <Text style={styles.footerText}>Buscar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => navigation.navigate('MisPedidos')}
        >
          <Text style={styles.footerText}>Pedidos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => Alert.alert('Próximamente', 'Esta función aún no está disponible.')}
        >
          <Text style={styles.footerText}>Recordatorios</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  progressCard: {
    backgroundColor: '#eef4ff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 24,
  },
  progressTitle: { fontSize: 16, fontWeight: '700', color: '#1E40AF' },
  progressSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  progressPlaceholder: {
    marginTop: 12,
    fontSize: 14,
    color: '#4B5563',
  },
  stepsWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
  },
  stepItem: { flex: 1, alignItems: 'center' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleCompleted: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  stepCircleCurrent: { borderColor: '#2563EB' },
  stepCircleText: { fontWeight: '700', color: '#4B5563' },
  stepCircleTextActive: { color: '#fff' },
  stepConnector: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    borderRadius: 999,
  },
  stepConnectorActive: { backgroundColor: '#2563EB' },
  stepConnectorInactive: { backgroundColor: '#CBD5F5' },
  stepLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  stepLabelActive: { color: '#1F2937', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  headerProfileButton: { marginRight: 8, padding: 6 },
  profileIcon: { fontSize: 20 },
  uploadButton: {
    backgroundColor: '#e6f0ff',
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  uploadIcon: { fontSize: 22, marginRight: 10 },
  uploadText: { fontSize: 16, fontWeight: '600', color: '#084298' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#222' },
  grid: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  card: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  cardDisabled: { opacity: 0.5 },
  cardText: { fontSize: 14, textAlign: 'center', color: '#333' },
  cardBadge: {
    marginTop: 8,
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
  },
  footer: {
    height: 60,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  footerButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footerText: { fontSize: 12, color: '#333' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
