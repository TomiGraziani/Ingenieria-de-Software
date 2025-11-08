import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';

const ORDER_STEPS = [
  { key: 'creado', label: 'Pedido creado' },
  { key: 'aceptado', label: 'Pedido aceptado' },
  { key: 'en_camino', label: 'En camino' },
  { key: 'recibido', label: 'Recibido' },
];

const normalizeStatus = (status) => {
  const value = (status || '').toString().trim().toLowerCase();
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
    entregado: 'recibido',
    recibido: 'recibido',
    completado: 'recibido',
  };

  return map[value] || value || 'creado';
};

const isActiveStatus = (status) => {
  const value = (status || '').toString().toLowerCase();
  return ![
    'recibido',
    'entregado',
    'cancelado',
    'rechazado',
    'completado',
    'finalizado',
  ].includes(value);
};

export default function HomeScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const [displayName, setDisplayName] = useState('Usuario');
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
      const running = sorted.find((order) => isActiveStatus(order.estado));
      setActiveOrder(running || null);
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

  const activeStatus = normalizeStatus(activeOrder?.estado);
  const currentStepIndex = activeStatus
    ? Math.max(ORDER_STEPS.findIndex((step) => step.key === activeStatus), 0)
    : 0;

  const hasActiveOrder = Boolean(activeOrder);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
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
            <Text style={styles.actionButtonText}>📦 Pedidos activos</Text>
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
  });
};
