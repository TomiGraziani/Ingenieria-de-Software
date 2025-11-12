import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/ThemeProvider";

const ESTADO_LABEL = {
  aceptado: "Pedido aceptado",
  en_camino: "En camino",
  entregado: "Entregado",
  no_entregado: "No entregado",
  rechazado: "Pedido rechazado",
};

const normalizeEstado = (estado) => {
  const value = (estado || "").toString().trim().toLowerCase();
  const map = {
    pendiente: "creado",
    creado: "creado",
    aceptado: "aceptado",
    aprobado: "aceptado",
    confirmado: "aceptado",
    en_preparacion: "aceptado",
    en_camino: "en_camino",
    "en camino": "en_camino",
    recogido: "en_camino",
    retirado: "en_camino",
    entregado: "entregado",
    recibido: "entregado",
    completado: "entregado",
    no_entregado: "no_entregado",
    "no entregado": "no_entregado",
    cancelado: "rechazado",
    rechazado: "rechazado",
  };

  return map[value] || value || "creado";
};

const formatDate = (value) => {
  if (!value) return "Fecha no disponible";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const sortByFechaDesc = (a, b) => {
  const dateA = new Date(a.fecha || a.createdAt || 0).getTime();
  const dateB = new Date(b.fecha || b.createdAt || 0).getTime();
  return dateB - dateA;
};

export default function VentasFarmaciaScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const [acceptedSales, setAcceptedSales] = useState([]);
  const [rejectedSales, setRejectedSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: true, title: "Ventas" });
  }, [navigation]);

  const loadSales = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const stored = await AsyncStorage.getItem("farmaciaOrders");
        const parsed = stored ? JSON.parse(stored) : [];
        const orders = Array.isArray(parsed) ? parsed : [];

        const accepted = [];
        const rejected = [];

        orders.forEach((order) => {
          const estadoNormalizado = normalizeEstado(order?.estado);
          const registro = {
            ...order,
            estado: estadoNormalizado,
            fecha: order?.createdAt || order?.fecha || order?.updatedAt,
          };

          if (["aceptado", "en_camino", "entregado", "no_entregado"].includes(estadoNormalizado)) {
            accepted.push(registro);
          } else if (estadoNormalizado === "rechazado") {
            rejected.push(registro);
          }
        });

        accepted.sort(sortByFechaDesc);
        rejected.sort(sortByFechaDesc);

        setAcceptedSales(accepted);
        setRejectedSales(rejected);
      } catch (error) {
        console.error("Error cargando ventas de farmacia:", error);
        setAcceptedSales([]);
        setRejectedSales([]);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadSales();
    }, [loadSales])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSales(false);
  }, [loadSales]);

  const renderSection = (title, data, emptyMessage) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {data.length === 0 ? (
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      ) : (
        data.map((item) => {
          const keyBase = item.id != null ? item.id.toString() : item.fecha || item.estado;
          return (
            <View key={`${keyBase}-${item.estado}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Pedido #{item.id}</Text>
                <View style={[styles.badge, styles[`badge_${item.estado}`] || styles.badgeDefault]}>
                  <Text style={styles.badgeText}>
                    {ESTADO_LABEL[item.estado] || item.estado}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardInfo}>Cliente: {item.clienteNombre || "Sin nombre"}</Text>
              <Text style={styles.cardInfo}>
                Productos: {item.productoNombre || item.producto_nombre || "Sin detalle"}
              </Text>
              <Text style={styles.cardInfo}>
                Dirección de entrega: {item.direccionEntrega || item.direccion_entrega || "A coordinar"}
              </Text>
              <Text style={styles.cardInfo}>Fecha: {formatDate(item.fecha)}</Text>
            </View>
          );
        })
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary || "#1E88E5"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderSection(
          "Pedidos aceptados",
          acceptedSales,
          "Todavía no tenés ventas aceptadas."
        )}
        {renderSection(
          "Pedidos rechazados",
          rejectedSales,
          "No rechazaste pedidos recientemente."
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme, insets) => {
  const bottomInset = insets?.bottom ?? 0;

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    content: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: bottomInset + 40,
      gap: 24,
    },
    loaderContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    section: {
      gap: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptyText: {
      color: theme.colors.textSecondary,
      fontSize: 15,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 8,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 3,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    cardInfo: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    badge: {
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    badgeText: {
      color: theme.colors.buttonText,
      fontWeight: "600",
      fontSize: 12,
      textTransform: "uppercase",
    },
    badge_aceptado: {
      backgroundColor: theme.colors.primary,
    },
    badge_en_camino: {
      backgroundColor: "#FF9800",
    },
    badge_entregado: {
      backgroundColor: "#2E7D32",
    },
    badge_rechazado: {
      backgroundColor: "#C62828",
    },
    badgeDefault: {
      backgroundColor: theme.colors.accent,
    },
  });
};
