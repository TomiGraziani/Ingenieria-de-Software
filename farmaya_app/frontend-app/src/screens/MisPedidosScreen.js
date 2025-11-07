import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

const STATUS_STEPS = [
  { key: 'creado', label: 'Pedido creado' },
  { key: 'aceptado', label: 'Pedido aceptado' },
  { key: 'en_camino', label: 'En camino' },
  { key: 'recibido', label: 'Recibido' },
];

const STATUS_COLORS = {
  creado: '#1E88E5',
  aceptado: '#2E7D32',
  en_camino: '#FF8F00',
  recibido: '#6D4C41',
};

const normalizeStatus = (status) => (status === 'aprobado' ? 'aceptado' : status);

const statusLabel = (status) =>
  STATUS_STEPS.find((step) => step.key === normalizeStatus(status))?.label || 'Estado desconocido';

const statusColor = (status) => STATUS_COLORS[normalizeStatus(status)] || '#757575';

const formatDateTime = (value) => {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const options = { hour: '2-digit', minute: '2-digit' };
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], options)}`;
};

export default function MisPedidosScreen({ navigation }) {
  const [orders, setOrders] = useState([]);

  const loadOrders = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('clienteOrders');
      if (!stored) {
        setOrders([]);
        return;
      }

      const parsed = JSON.parse(stored);
      const sorted = parsed
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.fecha || 0) - new Date(a.createdAt || a.fecha || 0)
        );

      setOrders(sorted);
    } catch (error) {
      console.error('Error cargando historial de pedidos:', error);
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    navigation.setOptions({ headerShown: true, title: 'Mis pedidos' });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.product}>{item.productoNombre || item.producto_nombre}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor(item.estado) }]}>
          <Text style={styles.badgeText}>{statusLabel(item.estado)}</Text>
        </View>
      </View>

      {item.farmaciaNombre || item.farmacia ? (
        <Text style={styles.detail}>🏥 {item.farmaciaNombre || item.farmacia}</Text>
      ) : null}
      <Text style={styles.detail}>📦 Cantidad: {item.cantidad || 1}</Text>
      {item.direccionEntrega || item.direccion_entrega ? (
        <Text style={styles.detail}>
          🏠 Entrega: {item.direccionEntrega || item.direccion_entrega}
        </Text>
      ) : null}
      <Text style={styles.detail}>🕒 {formatDateTime(item.createdAt || item.fecha)}</Text>
      <Text style={styles.detail}>
        {item.requiereReceta || item.requiere_receta
          ? '📜 Requiere receta'
          : '✅ Sin receta'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Todavía no tenés pedidos registrados</Text>
          <Text style={styles.emptySubtitle}>
            Cuando realices compras desde la app, vas a poder verlas acá.
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id?.toString() ?? Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  product: { fontSize: 16, fontWeight: '700', color: '#1E293B', flex: 1, marginRight: 8 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  detail: { fontSize: 14, color: '#424242', marginTop: 4 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E88E5', textAlign: 'center' },
  emptySubtitle: {
    fontSize: 14,
    color: '#607D8B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
