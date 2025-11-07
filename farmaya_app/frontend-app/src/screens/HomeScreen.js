import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import API from '../api/api';

export default function HomeScreen({ navigation }) {
  const [displayName, setDisplayName] = useState('Usuario');

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
      } catch (e) {
        console.error('Error cargando usuario:', e);
      }
    };

    loadUserAndConfigureHeader();
  }, [navigation]);

  // 🔹 Subir receta al backend
  const handleUpload = () => {
    Alert.alert(
      '¿Cómo subo mi receta?',
      'Cuando solicites un medicamento que requiera receta podrás adjuntar la foto o el PDF durante el pedido. '
        + 'Solo elegí el producto desde la farmacia y seguí los pasos del pedido para cargarla allí.'
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* 📤 Botón para subir receta */}
        <TouchableOpacity style={styles.uploadButton} onPress={handleUpload}>
          <Text style={styles.uploadIcon}>📤</Text>
          <Text style={styles.uploadText}>Cargar receta (foto o PDF)</Text>
        </TouchableOpacity>

        {/* 🔹 Acciones rápidas */}
        <Text style={styles.sectionTitle}>Acciones rápidas</Text>

        <View style={styles.grid}>
          {/* ✅ Buscar farmacias → va al mapa */}
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('BuscarFarmacia')}>
            <Text style={styles.cardText}>🔍 Buscar farmacia</Text>
          </TouchableOpacity>

          {/* 🛒 Mis pedidos (opcional, por ahora deshabilitado) */}
          <TouchableOpacity
            style={[styles.card, styles.cardDisabled]}
            onPress={() => Alert.alert('Próximamente', 'Esta función aún no está disponible.')}
          >
            <Text style={styles.cardText}>🛒 Mis pedidos</Text>
          </TouchableOpacity>

          {/* ⏰ Recordatorios (opcional, por ahora deshabilitado) */}
          <TouchableOpacity
            style={[styles.card, styles.cardDisabled]}
            onPress={() => Alert.alert('Próximamente', 'Esta función aún no está disponible.')}
          >
            <Text style={styles.cardText}>⏰ Recordatorios</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 🔹 Barra inferior */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.footerText}>Inicio</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('BuscarFarmacia')}>
          <Text style={styles.footerText}>Buscar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => Alert.alert('Próximamente', 'Esta función aún no está disponible.')}
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
