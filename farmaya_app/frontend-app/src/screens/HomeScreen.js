import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../theme/ThemeProvider';
import API from '../api/api';
import getClienteOrdersStorageKey from '../utils/storageKeys';

const ORDER_STEPS = [
  { key: 'creado', label: 'Pedido Creado' },
  { key: 'aceptado', label: 'Pedido Aceptado' },
  { key: 'en_camino', label: 'En Camino' },
  { key: 'entregado', label: 'Entregado' },
];

const STATUS_RANK = {
  creado: 0,
  pendiente: 0,
  aceptado: 1,
  aprobado: 1,
  confirmado: 1,
  en_preparacion: 1,
  preparando: 1,
  asignado: 1,
  en_camino: 2,
  retirado: 2,
  recogido: 2,
  enviado: 2,
  entregado: 3,
  recibido: 3,
  completado: 3,
  no_entregado: 3, // Mismo rango que entregado, comparten el 4to paso
};

const CANCELED_STATES = new Set(['cancelado', 'rechazado']);

// Filtrar detalles para mostrar solo los que tienen receta aprobada o no requieren receta
const filtrarDetalles = (detalles, estadoPedido) => {
  if (!detalles || !Array.isArray(detalles)) return [];

  // Si el pedido está aceptado o en un estado avanzado, filtrar detalles
  const estadosAvanzados = ['aceptado', 'en_preparacion', 'en_camino', 'entregado'];
  const estadoNormalizado = (estadoPedido || '').toString().toLowerCase();

  if (estadosAvanzados.includes(estadoNormalizado)) {
    return detalles.filter(
      (detalle) =>
        !detalle.requiere_receta ||
        detalle.estado_receta === 'aprobada' ||
        (detalle.estado_receta === 'rechazada' && detalle.receta_omitida)
    );
  }

  // Para pedidos pendientes, mostrar todos los detalles
  return detalles;
};

const normalizeOrderFromApi = (order) => {
  if (!order || typeof order !== 'object') {
    return null;
  }

  const detallesRaw = Array.isArray(order.detalles) ? order.detalles : [];
  const detallesFiltrados = filtrarDetalles(detallesRaw, order.estado);

  const productosResumen = detallesFiltrados.length
    ? detallesFiltrados
      .map((detalle) => {
        const nombreProducto =
          detalle.producto_nombre ||
          detalle.productoNombre ||
          detalle.producto ||
          'Producto';
        const cantidad = detalle.cantidad ?? 1;
        return `${nombreProducto} × ${cantidad}`;
      })
      .join(', ')
    : order.productoNombre || order.producto_nombre || '';

  const rawId =
    order.id ??
    order.ID ??
    order.uuid ??
    order.numero ??
    order.codigo ??
    null;

  const id = rawId != null ? rawId.toString() : order.createdAt || order.fecha || null;

  const direccionEntrega =
    order.direccion_entrega || order.direccionEntrega || order.direccion || '';

  return {
    ...order,
    id,
    estado: order.estado || 'pendiente',
    direccionEntrega,
    direccion_entrega: order.direccion_entrega || order.direccionEntrega || '',
    productoNombre:
      productosResumen || order.productoNombre || order.producto_nombre || 'Pedido',
    producto_nombre:
      productosResumen || order.producto_nombre || order.productoNombre || 'Pedido',
    farmaciaNombre: order.farmacia_nombre || order.farmaciaNombre || order.farmacia || '',
    farmacia: order.farmacia_nombre || order.farmacia || order.farmaciaNombre || '',
    motivo_no_entrega: order.motivo_no_entrega || order.motivoNoEntrega || '',
    createdAt: order.fecha || order.createdAt || order.created_at || new Date().toISOString(),
    detalles: detallesFiltrados, // Incluir detalles filtrados en el objeto normalizado
  };
};

const normalizeStatus = (status) => {
  const value = (status || '').toString().trim().toLowerCase();
  if (value === 'no_entregado' || value === 'no entregado') {
    return 'no_entregado';
  }
  const map = {
    pendiente: 'creado',
    creado: 'creado',
    aceptado: 'aceptado',
    aprobado: 'aceptado',
    confirmado: 'aceptado',
    en_preparacion: 'aceptado',
    preparando: 'aceptado',
    asignado: 'aceptado',
    'en camino': 'en_camino',
    en_camino: 'en_camino',
    recogido: 'en_camino',
    retirado: 'en_camino',
    enviado: 'en_camino',
    entregado: 'entregado',
    recibido: 'entregado',
    completado: 'entregado',
  };

  return map[value] || value || 'creado';
};

const isActiveStatus = (status) => {
  const value = (status || '').toString().toLowerCase();
  return ![
    'entregado',
    'cancelado',
    'rechazado',
    'completado',
    'finalizado',
    'no_entregado',
  ].includes(value);
};

const mergeOrderStatus = (order, storedOrders) => {
  const storedMatch = storedOrders.find(
    (stored) => stored?.id?.toString() === order?.id?.toString()
  );

  const apiNormalized = normalizeStatus(order?.estado);

  if (!storedMatch) {
    if (CANCELED_STATES.has(apiNormalized)) {
      return { ...order, estado: apiNormalized };
    }
    return { ...order, estado: apiNormalized };
  }

  const storedNormalized = normalizeStatus(storedMatch?.estado);

  if (CANCELED_STATES.has(apiNormalized)) {
    return { ...order, estado: apiNormalized };
  }

  if (CANCELED_STATES.has(storedNormalized)) {
    return { ...order, estado: storedNormalized };
  }

  const apiRank = STATUS_RANK[apiNormalized] ?? -1;
  const storedRank = STATUS_RANK[storedNormalized] ?? -1;

  // Priorizar el estado con mayor rango (más avanzado)
  // Si tienen el mismo rango, priorizar el del API (más reciente)
  if (storedRank > apiRank) {
    return { ...order, estado: storedNormalized };
  } else if (apiRank > storedRank) {
    return { ...order, estado: apiNormalized };
  } else {
    // Si tienen el mismo rango, priorizar el del API
    return { ...order, estado: apiNormalized };
  }
};

export default function HomeScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const [displayName, setDisplayName] = useState('Usuario');
  const [activeOrder, setActiveOrder] = useState(null);
  const [ordersCount, setOrdersCount] = useState(0);
  const lastRejectedAlertId = useRef(null);
  const [rejectedRecetaModal, setRejectedRecetaModal] = useState(null);
  const [recetaReenviando, setRecetaReenviando] = useState(false);
  const [noEntregadoOrder, setNoEntregadoOrder] = useState(null);
  const [noEntregadoModalVisible, setNoEntregadoModalVisible] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const storageKey = await getClienteOrdersStorageKey();
      let orders = null;
      let storedBeforeFetch = [];

      try {
        const existingRaw = await AsyncStorage.getItem(storageKey);
        if (existingRaw) {
          const parsedExisting = JSON.parse(existingRaw);
          if (Array.isArray(parsedExisting)) {
            storedBeforeFetch = parsedExisting;
          }
        }
      } catch (existingError) {
        console.error('Error leyendo pedidos almacenados del cliente:', existingError);
      }

      try {
        const response = await API.get('pedidos/mis/');
        const data = Array.isArray(response.data) ? response.data : [];
        const normalized = data
          .map(normalizeOrderFromApi)
          .filter((order) => order && order.id != null)
          .map((order) => mergeOrderStatus(order, storedBeforeFetch));

        await AsyncStorage.setItem(storageKey, JSON.stringify(normalized));
        orders = normalized;
      } catch (apiError) {
        console.error(
          'Error sincronizando pedidos desde la API:',
          apiError?.response?.data || apiError
        );
      }

      if (!orders) {
        const stored = await AsyncStorage.getItem(storageKey);
        if (!stored) {
          setActiveOrder(null);
          setOrdersCount(0);
          return;
        }

        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            orders = parsed;
          }
        } catch (parseError) {
          console.error('Error interpretando pedidos almacenados del cliente:', parseError);
        }
      }

      if (!orders || !Array.isArray(orders)) {
        setActiveOrder(null);
        setOrdersCount(0);
        return;
      }

      const sorted = orders
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.fecha || 0) - new Date(a.createdAt || a.fecha || 0)
        );

      setOrdersCount(sorted.length);
      // Buscar pedidos activos (excluyendo no_entregado ya que es un estado final)
      const running = sorted.find((order) => {
        const estado = (order?.estado || '').toString().toLowerCase();
        return isActiveStatus(estado);
      });
      setActiveOrder(running || null);

      // Buscar pedidos no entregados (para mostrar el modal solo si no se cerró antes para este pedido)
      const noEntregado = sorted.find(
        (order) => (order?.estado || '').toString().toLowerCase() === 'no_entregado'
      );
      if (noEntregado) {
        const noEntregadoId = noEntregado.id?.toString();
        // Verificar en AsyncStorage si este pedido ya fue cerrado
        try {
          const closedOrdersKey = await getClienteOrdersStorageKey();
          const closedOrdersStorageKey = `${closedOrdersKey}_closed_no_entregado`;
          const closedOrdersStr = await AsyncStorage.getItem(closedOrdersStorageKey);
          const closedOrders = closedOrdersStr ? JSON.parse(closedOrdersStr) : [];
          const isClosed = Array.isArray(closedOrders) && closedOrders.includes(noEntregadoId);

          if (!isClosed) {
            setNoEntregadoOrder(noEntregado);
            setNoEntregadoModalVisible(true);
          } else {
            setNoEntregadoOrder(null);
            setNoEntregadoModalVisible(false);
          }
        } catch (error) {
          console.error('Error verificando pedidos cerrados:', error);
          // Si hay error, mostrar el modal por seguridad
          setNoEntregadoOrder(noEntregado);
          setNoEntregadoModalVisible(true);
        }
      } else {
        setNoEntregadoOrder(null);
        setNoEntregadoModalVisible(false);
      }

      // Buscar recetas rechazadas pendientes de acción del cliente
      const pedidosConRecetasRechazadas = sorted.filter((order) => {
        if (!order.detalles || !Array.isArray(order.detalles)) return false;
        return order.detalles.some(
          (detalle) =>
            detalle.requiere_receta &&
            detalle.estado_receta === 'rechazada' &&
            !detalle.receta_omitida
        );
      });

      if (pedidosConRecetasRechazadas.length > 0 && !rejectedRecetaModal) {
        const pedidoConRecetaRechazada = pedidosConRecetasRechazadas[0];
        const recetaRechazada = pedidoConRecetaRechazada.detalles.find(
          (detalle) =>
            detalle.requiere_receta &&
            detalle.estado_receta === 'rechazada' &&
            !detalle.receta_omitida
        );

        if (recetaRechazada) {
          setRejectedRecetaModal({
            pedidoId: pedidoConRecetaRechazada.id,
            detalleId: recetaRechazada.id,
            productoNombre: recetaRechazada.producto_nombre || 'producto',
          });
        }
      }

      const latestRejected = sorted.find(
        (order) => (order?.estado || '').toString().toLowerCase() === 'rechazado'
      );

      if (!running && latestRejected && !pedidosConRecetasRechazadas.length) {
        const rejectionIdentifier =
          latestRejected.id ??
          latestRejected.numero ??
          latestRejected.codigo ??
          latestRejected.uuid ??
          latestRejected.createdAt ??
          latestRejected.fecha ??
          JSON.stringify(latestRejected);

        if (lastRejectedAlertId.current !== rejectionIdentifier) {
          lastRejectedAlertId.current = rejectionIdentifier;
          Alert.alert(
            'Pedido rechazado',
            'La farmacia ha rechazado tu pedido. Podés revisar tus pedidos para más información.'
          );
        }
      } else if (!latestRejected) {
        lastRejectedAlertId.current = null;
      }
    } catch (error) {
      console.error('Error cargando pedidos del cliente:', error);
      setActiveOrder(null);
      setOrdersCount(0);
    }
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        if (stored) {
          const user = JSON.parse(stored);
          const name = user.nombre || (user.email ? user.email.split('@')[0] : 'Usuario');
          setDisplayName(name);
        }
      } catch (error) {
        console.error('Error cargando usuario:', error);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.colors.background },
      headerTitle: () => <Text style={styles.headerTitle}>Hola, {displayName}</Text>,
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.headerProfileButton}>
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme, displayName, styles.headerTitle, styles.headerProfileButton, styles.profileIcon]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  useEffect(() => {
    // Actualizar cada 2 segundos para ser más responsivo a cambios de estado
    const interval = setInterval(() => {
      loadOrders();
    }, 2000);

    return () => clearInterval(interval);
  }, [loadOrders]);

  // Cerrar sesión
  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Querés cerrar la sesión actual?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          try {
            const storageKey = await getClienteOrdersStorageKey();
            await AsyncStorage.multiRemove([
              "accessToken",
              "refreshToken",
              "user",
              storageKey,
            ]);
          } catch (storageError) {
            console.error("Error al limpiar la sesión:", storageError);
          } finally {
            navigation.replace("Login");
          }
        },
      },
    ]);
  };

  const hasActiveOrder = Boolean(activeOrder);
  const rawStatus = hasActiveOrder ? (activeOrder?.estado || '').toString().toLowerCase() : null;
  const activeStatus = hasActiveOrder ? normalizeStatus(activeOrder?.estado) : null;
  // Si el estado es "no_entregado", mapearlo a "entregado" para mostrar en el 4to paso
  const displayStatus = rawStatus === 'no_entregado' ? 'entregado' : activeStatus;
  const currentStepIndex = hasActiveOrder && displayStatus
    ? Math.max(ORDER_STEPS.findIndex((step) => step.key === displayStatus), 0)
    : -1;

  // Una etapa está completada si su índice es menor o igual al índice de la etapa actual
  // Esto significa que cuando el estado es "creado", la etapa 1 (índice 0) está completada
  // Cuando el estado es "aceptado", las etapas 1 y 2 (índices 0 y 1) están completadas, etc.
  const isStepCompleted = (index) => {
    if (currentStepIndex === -1) return false;
    return index <= currentStepIndex;
  };

  const solicitarReceta = () =>
    new Promise((resolve) => {
      let alreadyResolved = false;

      const safeResolve = (value) => {
        if (!alreadyResolved) {
          alreadyResolved = true;
          resolve(value);
        }
      };

      const tomarFoto = async () => {
        try {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Permisos necesarios',
              'Se necesitan permisos de cámara para tomar una foto de la receta.'
            );
            safeResolve(null);
            return;
          }

          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.8,
          });

          if (result.canceled) {
            safeResolve(null);
            return;
          }

          if (result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            const receta = {
              uri: asset.uri,
              name: `receta_${Date.now()}.jpg`,
              mimeType: 'image/jpeg',
              type: 'image/jpeg',
            };
            safeResolve(receta);
          } else {
            safeResolve(null);
          }
        } catch (error) {
          console.error('Error al tomar foto:', error);
          Alert.alert('Error', 'No se pudo tomar la foto de la receta.');
          safeResolve(null);
        }
      };

      const abrirPicker = async () => {
        try {
          const result = await DocumentPicker.getDocumentAsync({
            type: ['image/*', 'application/pdf'],
            copyToCacheDirectory: true,
          });

          if (result.canceled) {
            safeResolve(null);
            return;
          }

          safeResolve(result.assets?.[0] || null);
        } catch (error) {
          console.error('Error al seleccionar receta:', error);
          Alert.alert('Error', 'No se pudo seleccionar el archivo de la receta.');
          safeResolve(null);
        }
      };

      Alert.alert(
        'Receta necesaria',
        'Este medicamento requiere que adjuntes una receta médica.',
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => safeResolve(null) },
          { text: '📷 Tomar foto', onPress: () => tomarFoto() },
          { text: '📁 Seleccionar archivo', onPress: () => abrirPicker() },
        ],
        { cancelable: false }
      );
    });

  const reenviarReceta = async () => {
    if (!rejectedRecetaModal) return;

    try {
      setRecetaReenviando(true);
      const receta = await solicitarReceta();

      if (!receta) {
        setRecetaReenviando(false);
        return;
      }

      const formData = new FormData();
      formData.append('receta', {
        uri: receta.uri,
        name: receta.name || `receta-${Date.now()}`,
        type: receta.mimeType || 'image/jpeg',
      });

      await API.post(
        `pedidos/detalles/${rejectedRecetaModal.detalleId}/receta/reenviar/`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      Alert.alert('✅ Receta reenviada', 'Tu receta fue enviada nuevamente a la farmacia.');
      setRejectedRecetaModal(null);
      loadOrders();
    } catch (error) {
      console.error('Error al reenviar receta:', error.response?.data || error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo reenviar la receta.');
    } finally {
      setRecetaReenviando(false);
    }
  };

  const omitirReceta = async () => {
    if (!rejectedRecetaModal) return;

    Alert.alert(
      '¿Omitir receta?',
      'Si omitís la receta, el pedido se realizará sin este medicamento. ¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Omitir',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.post(
                `pedidos/detalles/${rejectedRecetaModal.detalleId}/receta/omitir/`
              );

              Alert.alert(
                '✅ Receta omitida',
                'El pedido se realizará sin este medicamento cuando la farmacia lo acepte.'
              );
              setRejectedRecetaModal(null);
              loadOrders();
            } catch (error) {
              console.error('Error al omitir receta:', error.response?.data || error);
              Alert.alert('Error', error.response?.data?.detail || 'No se pudo omitir la receta.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <TouchableOpacity style={styles.logoutFab} onPress={handleLogout}>
        <Text style={styles.logoutFabText}>🚪 Cerrar sesión</Text>
      </TouchableOpacity>
      <Modal
        visible={noEntregadoModalVisible && noEntregadoOrder !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={async () => {
          const orderId = noEntregadoOrder?.id?.toString();
          setNoEntregadoModalVisible(false);
          setNoEntregadoOrder(null);

          // Guardar en AsyncStorage que este pedido fue cerrado
          if (orderId) {
            try {
              const storageKey = await getClienteOrdersStorageKey();
              const closedOrdersStorageKey = `${storageKey}_closed_no_entregado`;
              const closedOrdersStr = await AsyncStorage.getItem(closedOrdersStorageKey);
              const closedOrders = closedOrdersStr ? JSON.parse(closedOrdersStr) : [];
              if (!Array.isArray(closedOrders)) {
                await AsyncStorage.setItem(closedOrdersStorageKey, JSON.stringify([orderId]));
              } else if (!closedOrders.includes(orderId)) {
                closedOrders.push(orderId);
                await AsyncStorage.setItem(closedOrdersStorageKey, JSON.stringify(closedOrders));
              }
            } catch (error) {
              console.error('Error guardando pedido cerrado:', error);
            }
          }

          // Asegurar que activeOrder no incluya el pedido no_entregado
          setActiveOrder((prev) => {
            if (prev && (prev.estado || '').toString().toLowerCase() === 'no_entregado') {
              return null;
            }
            return prev;
          });
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.noEntregadoModalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={async () => {
                const orderId = noEntregadoOrder?.id?.toString();
                setNoEntregadoModalVisible(false);
                setNoEntregadoOrder(null);

                // Guardar en AsyncStorage que este pedido fue cerrado
                if (orderId) {
                  try {
                    const storageKey = await getClienteOrdersStorageKey();
                    const closedOrdersStorageKey = `${storageKey}_closed_no_entregado`;
                    const closedOrdersStr = await AsyncStorage.getItem(closedOrdersStorageKey);
                    const closedOrders = closedOrdersStr ? JSON.parse(closedOrdersStr) : [];
                    if (!Array.isArray(closedOrders)) {
                      await AsyncStorage.setItem(closedOrdersStorageKey, JSON.stringify([orderId]));
                    } else if (!closedOrders.includes(orderId)) {
                      closedOrders.push(orderId);
                      await AsyncStorage.setItem(closedOrdersStorageKey, JSON.stringify(closedOrders));
                    }
                  } catch (error) {
                    console.error('Error guardando pedido cerrado:', error);
                  }
                }

                // Asegurar que activeOrder no incluya el pedido no_entregado
                setActiveOrder((prev) => {
                  if (prev && (prev.estado || '').toString().toLowerCase() === 'no_entregado') {
                    return null;
                  }
                  return prev;
                });
              }}
            >
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.noEntregadoModalTitle}>❌ Producto no fue entregado</Text>
            <Text style={styles.noEntregadoModalMotivo}>
              Motivo: {noEntregadoOrder?.motivo_no_entrega || 'No se especificó motivo'}
            </Text>
          </View>
        </View>
      </Modal>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeOrder ? (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Seguimiento de tu pedido</Text>
            <Text style={styles.progressSubtitle}>
              {activeOrder.productoNombre || activeOrder.producto_nombre || 'Pedido'} ·{' '}
              {activeOrder.farmaciaNombre || activeOrder.farmacia || 'Farmacia'}
            </Text>
            <View style={styles.stepsWrapper}>
              {ORDER_STEPS.map((step, index) => {
                // Si es el último paso (entregado) y el estado real es "no_entregado", mostrar "No Entregado"
                const isLastStep = index === ORDER_STEPS.length - 1;
                const isNoEntregado = rawStatus === 'no_entregado';
                const stepLabel = isLastStep && isNoEntregado ? 'No Entregado' : step.label;

                const isCurrent = step.key === displayStatus;
                const isCompleted = isStepCompleted(index);
                const isReached = isCompleted || isCurrent;
                return (
                  <View key={step.key} style={styles.stepItem}>
                    <View style={styles.stepRow}>
                      <View
                        style={[
                          styles.stepCircle,
                          isCompleted && styles.stepCircleCompleted,
                          isCurrent && styles.stepCircleCurrent,
                          isNoEntregado && isLastStep && isCurrent && { borderColor: '#D32F2F', backgroundColor: '#D32F2F' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.stepCircleText,
                            (isCompleted || isCurrent) && styles.stepCircleTextActive,
                          ]}
                        >
                          {isReached ? '✓' : index + 1}
                        </Text>
                      </View>
                      {index < ORDER_STEPS.length - 1 && (
                        <View
                          style={[
                            styles.stepConnector,
                            isStepCompleted(index + 1)
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
                        isNoEntregado && isLastStep && isCurrent && { color: '#D32F2F' },
                      ]}
                    >
                      {stepLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Acciones rápidas</Text>

        <View
          style={[
            styles.actionsContainer,
            hasActiveOrder && styles.actionsContainerWithProgress,
          ]}
        >
          <TouchableOpacity
            style={[styles.actionButton, hasActiveOrder && styles.actionButtonCompact]}
            onPress={() => navigation.navigate('BuscarFarmacia')}
          >
            <Text style={styles.actionButtonText}>🔍 Buscar farmacias</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, hasActiveOrder && styles.actionButtonCompact]}
            onPress={() => navigation.navigate('MisPedidos')}
          >
            <Text style={styles.actionButtonText}>📦 Mis pedidos</Text>
            {ordersCount > 0 ? (
              <Text style={styles.actionBadge}>
                {ordersCount} {ordersCount === 1 ? 'pedido' : 'pedidos'}
              </Text>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, hasActiveOrder && styles.actionButtonCompact]}
            onPress={() => navigation.navigate('Recordatorios')}
          >
            <Text style={styles.actionButtonText}>⏰ Recordatorios</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.footerText}>Inicio</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('BuscarFarmacia')}>
          <Text style={styles.footerText}>Buscar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('MisPedidos')}>
          <Text style={styles.footerText}>Pedidos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => navigation.navigate('Recordatorios')}
        >
          <Text style={styles.footerText}>Recordatorios</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={!!rejectedRecetaModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectedRecetaModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📄 Receta rechazada</Text>
            <Text style={styles.modalSubtitle}>
              Tu receta para "{rejectedRecetaModal?.productoNombre}" fue rechazada por la farmacia.
              ¿Querés volver a enviarla o realizar el pedido de todas formas sin esa receta?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={omitirReceta}
                disabled={recetaReenviando}
              >
                <Text style={styles.modalButtonText}>Omitir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={reenviarReceta}
                disabled={recetaReenviando}
              >
                <Text style={styles.modalButtonText}>
                  {recetaReenviando ? 'Enviando...' : 'Reenviar receta'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme, insets) => {
  const bottomInset = insets?.bottom ?? 0;

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
    progressCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 24,
      marginTop: 16,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    progressTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
    progressSubtitle: {
      marginTop: 8,
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    stepsWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 28,
    },
    stepItem: { flex: 1, alignItems: 'center' },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      justifyContent: 'center',
    },
    stepCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 2,
      borderColor: theme.colors.muted,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepCircleCompleted: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
    stepCircleCurrent: { borderColor: theme.colors.accent },
    stepCircleText: { fontWeight: '700', color: theme.colors.textSecondary },
    stepCircleTextActive: { color: theme.colors.buttonText },
    stepConnector: {
      flex: 1,
      height: 2,
      marginHorizontal: 4,
      borderRadius: 999,
    },
    stepConnectorActive: { backgroundColor: theme.colors.primary },
    stepConnectorInactive: { backgroundColor: theme.colors.muted },
    stepLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 10,
      paddingHorizontal: 4,
    },
    stepLabelActive: { color: theme.colors.text, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
    headerProfileButton: { marginRight: 8, padding: 6 },
    profileIcon: { fontSize: 20 },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 18,
      color: theme.colors.text,
    },
    actionsContainer: {
      width: '100%',
      marginTop: 8,
    },
    actionsContainerWithProgress: {
      marginTop: 0,
    },
    actionButton: {
      width: '100%',
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      paddingVertical: 20,
      paddingHorizontal: 24,
      marginBottom: 14,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonCompact: {
      borderRadius: 16,
      paddingVertical: 16,
      marginBottom: 10,
    },
    actionButtonText: {
      fontSize: 16,
      textAlign: 'center',
      color: theme.colors.text,
      fontWeight: '600',
    },
    noEntregadoBanner: {
      backgroundColor: '#FFEBEE',
      borderLeftWidth: 4,
      borderLeftColor: '#D32F2F',
      padding: 16,
      marginBottom: 16,
      borderRadius: 8,
      marginHorizontal: 20,
      marginTop: 8,
    },
    noEntregadoTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#D32F2F',
      marginBottom: 8,
    },
    noEntregadoMotivo: {
      fontSize: 14,
      color: '#666',
      lineHeight: 20,
    },
    noEntregadoModalContent: {
      backgroundColor: '#FFEBEE',
      borderRadius: 20,
      padding: 24,
      width: '85%',
      maxWidth: 400,
      borderWidth: 2,
      borderColor: '#D32F2F',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 15,
      position: 'relative',
    },
    modalCloseButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#D32F2F',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    modalCloseButtonText: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: 'bold',
      lineHeight: 20,
    },
    noEntregadoModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#D32F2F',
      marginBottom: 16,
      marginTop: 8,
      textAlign: 'center',
    },
    noEntregadoModalMotivo: {
      fontSize: 16,
      color: '#333',
      lineHeight: 24,
      textAlign: 'center',
    },
    actionBadge: {
      marginTop: 8,
      fontSize: 12,
      color: theme.colors.accent,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 12 + bottomInset,
    },
    footerButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    footerText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
    logoutFab: {
      position: "absolute",
      right: 16,
      bottom: 120 + bottomInset,
      backgroundColor: "#C62828",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 24,
      shadowColor: "#000",
      shadowOpacity: 0.4,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 10,
      zIndex: 1000,
    },
    logoutFabText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 24,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    modalSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 24,
      textAlign: 'center',
      lineHeight: 20,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    modalButtonPrimary: {
      backgroundColor: theme.colors.primary,
    },
    modalButtonSecondary: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalButtonText: {
      color: theme.colors.buttonText,
      fontWeight: '600',
      fontSize: 15,
    },
  });
};
