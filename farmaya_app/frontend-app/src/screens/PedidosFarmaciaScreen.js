import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import API from '../api/api';

export default function PedidosFarmaciaScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [farmacia, setFarmacia] = useState(null);

  const cargarFarmacia = useCallback(async () => {
    try {
      const response = await API.get('usuarios/me/');
      setFarmacia(response.data);
      return response.data;
    } catch (error) {
      console.error('Error al cargar datos de la farmacia:', error.response?.data || error);
      Alert.alert('Error', 'No se pudieron cargar los datos de la farmacia.');
      return null;
    }
  }, []);

  const normalizePedido = (item, farmaciaInfo) => {
    const farmaciaData = farmaciaInfo || farmacia || {};
    const id = item.id?.toString?.() ?? item.id?.toString() ?? Date.now().toString();
    const productoNombre =
      item.producto_nombre ||
      item.productoNombre ||
      item.productos?.[0]?.nombre ||
      item.producto?.nombre ||
      'Producto';

    const direccionEntrega =
      item.direccion_entrega || item.direccionEntrega || 'Entrega a coordinar';

    const requiereReceta =
      item.requiere_receta ??
      item.requiereReceta ??
      item.producto?.requiere_receta ??
      false;

    return {
      id,
      usuario_email: item.usuario_email || item.cliente_nombre || 'Cliente',
      clienteNombre: item.clienteNombre || item.usuario_nombre,
      producto_nombre: productoNombre,
      productoNombre,
      cantidad: item.cantidad || item.detalles?.[0]?.cantidad || 1,
      direccion_entrega: direccionEntrega,
      direccionEntrega,
      receta_url: item.receta_url,
      requiereReceta,
      estado: item.estado || 'pendiente',
      farmacia: farmaciaData.nombre,
      farmaciaNombre: farmaciaData.nombre,
      farmaciaDireccion: farmaciaData.direccion,
      createdAt: item.fecha || item.createdAt || new Date().toISOString(),
    };
  };

  const loadStoredOrders = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('farmaciaOrders');
      if (stored) {
        setOrders(JSON.parse(stored));
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Error leyendo pedidos locales de farmacia:', error);
      setOrders([]);
    }
  }, []);

  const saveFarmaciaOrders = async (list) => {
    try {
      await AsyncStorage.setItem('farmaciaOrders', JSON.stringify(list));
    } catch (error) {
      console.error('Error guardando pedidos de farmacia:', error);
    }
  };

  const syncClienteOrders = async (list) => {
    try {
      const stored = await AsyncStorage.getItem('clienteOrders');
      if (!stored) return;
      const clienteOrders = JSON.parse(stored);
      let changed = false;

      const updated = clienteOrders.map((order) => {
        const match = list.find((o) => o.id?.toString() === order.id?.toString());
        if (!match) return order;

        if (['aceptado', 'aprobado'].includes(match.estado) && order.estado === 'creado') {
          changed = true;
          return { ...order, estado: 'aceptado' };
        }

        if (match.estado === 'en_camino' && !['en_camino', 'recibido'].includes(order.estado)) {
          changed = true;
          return { ...order, estado: 'en_camino' };
        }

        if (match.estado === 'entregado' && order.estado !== 'recibido') {
          changed = true;
          return { ...order, estado: 'recibido' };
        }

        return order;
      });

      if (changed) {
        await AsyncStorage.setItem('clienteOrders', JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error sincronizando pedidos del cliente:', error);
    }
  };

  const syncRepartidorOrders = async (list, farmaciaInfo) => {
    try {
      const stored = await AsyncStorage.getItem('pedidosRepartidor');
      const repartidorOrders = stored ? JSON.parse(stored) : [];
      const updated = [...repartidorOrders];
      const farmaciaData = farmaciaInfo || farmacia || {};

      list.forEach((order) => {
        const id = order.id?.toString();
        const index = updated.findIndex((item) => item.id?.toString() === id);
        const disponible = ['aceptado', 'aprobado'].includes(order.estado);

        if (disponible) {
          if (index === -1) {
            updated.push({
              id,
              farmacia: order.farmaciaNombre || farmaciaData.nombre,
              direccionFarmacia: order.farmaciaDireccion || farmaciaData.direccion,
              direccionCliente: order.direccionEntrega || order.direccion_entrega,
              productos: order.productoNombre || order.producto_nombre,
              requiereReceta: order.requiereReceta,
              estado: 'confirmado',
              distancia: 3.2,
              createdAt: order.createdAt,
            });
          } else if (updated[index].estado === 'confirmado') {
            updated[index] = {
              ...updated[index],
              farmacia: order.farmaciaNombre || updated[index].farmacia,
              direccionCliente:
                order.direccionEntrega || order.direccion_entrega || updated[index].direccionCliente,
              productos: order.productoNombre || order.producto_nombre || updated[index].productos,
            };
          }
        } else if (index !== -1 && updated[index].estado === 'confirmado') {
          updated.splice(index, 1);
        }
      });

      await AsyncStorage.setItem('pedidosRepartidor', JSON.stringify(updated));
    } catch (error) {
      console.error('Error sincronizando pedidos del repartidor:', error);
    }
  };

  const cargarPedidos = useCallback(
    async (farmaciaData = farmacia) => {
      try {
        await loadStoredOrders();

        const farmaciaInfo = farmaciaData || farmacia;
        if (!farmaciaInfo?.id) return;

        const token = await AsyncStorage.getItem('accessToken');
        if (!token) {
          return;
        }

        const response = await API.get(`pedidos/farmacia/${farmaciaInfo.id}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = Array.isArray(response.data)
          ? response.data.map((item) => normalizePedido(item, farmaciaInfo))
          : [];

        setOrders(data);
        await saveFarmaciaOrders(data);
        await syncClienteOrders(data);
        await syncRepartidorOrders(data, farmaciaInfo);
      } catch (error) {
        console.error('Error al cargar pedidos:', error.response?.data || error);
      }
    },
    [farmacia, loadStoredOrders]
  );

  useEffect(() => {
    const init = async () => {
      try {
        const farmaciaData = await cargarFarmacia();
        await cargarPedidos(farmaciaData);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [cargarFarmacia, cargarPedidos]);

  useFocusEffect(
    useCallback(() => {
      if (farmacia) {
        cargarPedidos(farmacia);
      } else {
        loadStoredOrders();
      }
    }, [farmacia, cargarPedidos, loadStoredOrders])
  );

  // 🔹 Descargar y abrir receta
  const openFile = async (url) => {
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
        return;
      }

      const fileUri = FileSystem.documentDirectory + 'receta_temp.pdf';
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error('Error al abrir archivo:', error);
      Alert.alert('Error', 'No se pudo abrir la receta.');
    }
  };

  // 🔹 Validar receta → cambiar estado del pedido
  const validarReceta = async (pedidoId) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        await API.put(
          `accounts/pedidos/${pedidoId}/`,
          { estado: 'aprobado' },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      const updatedOrders = orders.map((o) =>
        o.id?.toString() === pedidoId.toString() ? { ...o, estado: 'aceptado' } : o
      );

      setOrders(updatedOrders);
      await saveFarmaciaOrders(updatedOrders);
      await syncClienteOrders(updatedOrders);
      await syncRepartidorOrders(updatedOrders, farmacia);

      Alert.alert('✅ Receta validada', 'El pedido fue aprobado.');
    } catch (error) {
      console.error('Error al validar receta:', error.response?.data || error);
      Alert.alert('Error', 'No se pudo validar la receta.');
    }
  };

  // Filtrar para NO mostrar pedidos retirados
  const visibleOrders = orders.filter(o => o.estado !== 'retirado');

  const estadoLabel = (estado) => {
    switch (estado) {
      case 'pendiente':
        return '⏳ Pendiente';
      case 'aceptado':
      case 'aprobado':
        return '✅ Aceptado';
      case 'en_camino':
        return '🚚 En camino';
      case 'entregado':
        return '📦 Entregado';
      default:
        return estado;
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.text}>👤 Cliente: {item.usuario_email || 'Cliente'}</Text>
      <Text style={styles.text}>💊 Producto: {item.productoNombre || item.producto_nombre}</Text>
      <Text style={styles.text}>📦 Cantidad: {item.cantidad || 1}</Text>
      <Text style={styles.text}>🏠 Dirección: {item.direccionEntrega || item.direccion_entrega}</Text>

      {item.requiereReceta ? (
        item.receta_url ? (
          <>
            <Text style={styles.text}>📜 Receta adjunta</Text>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => openFile(item.receta_url)}
            >
              <Text style={styles.smallButtonText}>📄 Ver receta</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.text}>📜 Receta pendiente de validación</Text>
        )
      ) : (
        <Text style={styles.text}>✅ No requiere receta</Text>
      )}

      <Text style={styles.text}>📌 Estado: {estadoLabel(item.estado)}</Text>

      {item.requiereReceta && item.estado === 'pendiente' && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => validarReceta(item.id)}
        >
          <Text style={styles.buttonText}>Validar Receta</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading)
    return <ActivityIndicator size="large" color="#1E88E5" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📦 Pedidos Recibidos</Text>
      <FlatList
        data={visibleOrders}
        keyExtractor={(item) => item.id?.toString() ?? Math.random().toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text>No hay pedidos nuevos</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  text: { fontSize: 15, marginBottom: 6, color: '#333' },
  smallButton: {
    backgroundColor: '#6c8eff',
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 6,
    width: 120,
  },
  smallButtonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  button: {
    backgroundColor: '#1E88E5',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
});
