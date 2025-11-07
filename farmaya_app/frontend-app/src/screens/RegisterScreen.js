import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api';
import { useTheme } from '../theme/ThemeProvider';

export default function RegisterScreen({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('cliente');
  const [direccion, setDireccion] = useState('');
  const [horarios, setHorarios] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validateTelefono = (value) => /^(\+?\d[\d\s-]{6,})$/.test(value.trim());

  const handleRegister = async () => {
    if (!nombre || !email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios.');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Por favor ingresa un email válido.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (rol === 'farmacia') {
      if (!telefono.trim()) {
        Alert.alert('Error', 'Ingresá un teléfono de contacto para la farmacia.');
        return;
      }

      if (!validateTelefono(telefono)) {
        Alert.alert('Error', 'Ingresá un teléfono válido (incluí el código de área).');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        nombre,
        email,
        password,
        tipo_usuario: rol, // 👈 coincide con el backend
        direccion,
        horarios,
      };

      const trimmedPhone = telefono.trim();
      if (trimmedPhone) {
        payload.telefono = trimmedPhone;
      }

      // 🔹 Petición al backend para registrar
      const response = await API.post('register/', payload);

      console.log('✅ Usuario registrado:', response.data);

      // 🔹 Luego de registrarse, login automático (opcional)
      const loginResponse = await API.post('login/', { email, password });
      const { access, refresh } = loginResponse.data;

      await AsyncStorage.setItem('accessToken', access);
      await AsyncStorage.setItem('refreshToken', refresh);

      // 🔹 Obtener datos del usuario recién creado
      const userResponse = await API.get('usuarios/me/', {
        headers: { Authorization: `Bearer ${access}` },
      });

      const user = userResponse.data;
      await AsyncStorage.setItem('user', JSON.stringify(user));

      Alert.alert('✅ Registro exitoso', 'Sesión iniciada correctamente.');

      // 🔹 Redirigir según tipo de usuario
      if (user.tipo_usuario === 'farmacia') {
        navigation.replace('HomeFarmacia');
      } else if (user.tipo_usuario === 'repartidor') {
        navigation.replace('HomeRepartidor');
      } else {
        navigation.replace('Home');
      }
    } catch (error) {
      console.error('❌ Error al registrar usuario:', error.response?.data || error);
      Alert.alert(
        'Error',
        error.response?.data?.detail ||
          'No se pudo completar el registro. Intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.tagline}>Sumate a FarmaYa</Text>
          <Text style={styles.title}>Crear cuenta</Text>

          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            style={styles.input}
            placeholder="Cómo te llamas"
            placeholderTextColor={theme.colors.textSecondary}
            value={nombre}
            onChangeText={setNombre}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Ingresá tu correo"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={theme.colors.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Text style={styles.label}>Selecciona tu rol</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={rol}
              onValueChange={(itemValue) => setRol(itemValue)}
              dropdownIconColor={theme.colors.accent}
              style={styles.picker}
            >
              <Picker.Item label="Cliente" value="cliente" />
              <Picker.Item label="Farmacia" value="farmacia" />
              <Picker.Item label="Repartidor" value="repartidor" />
            </Picker>
          </View>

          {rol === 'farmacia' && (
            <>
              <Text style={styles.label}>Teléfono de contacto</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: +54 9 11 2345 6789"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="phone-pad"
                value={telefono}
                onChangeText={setTelefono}
              />

              <Text style={styles.label}>Dirección de la farmacia</Text>
              <TextInput
                style={styles.input}
                placeholder="Calle y número"
                placeholderTextColor={theme.colors.textSecondary}
                value={direccion}
                onChangeText={setDireccion}
              />

              <Text style={styles.label}>Horarios de atención</Text>
              <TextInput
                style={styles.input}
                placeholder="Lun a vie 9 a 18 hs"
                placeholderTextColor={theme.colors.textSecondary}
                value={horarios}
                onChangeText={setHorarios}
              />
            </>
          )}

          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} disabled={loading}>
              <Text style={styles.primaryButtonText}>Registrarme</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.footerText}>¿Ya tenés cuenta?</Text>
          <TouchableOpacity onPress={() => navigation.replace('Login')} style={styles.linkButton}>
            <Text style={styles.link}>Iniciá sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 24,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      padding: 28,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tagline: {
      textAlign: 'center',
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 6,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 26,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 24,
      textAlign: 'center',
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 18,
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      fontSize: 16,
    },
    pickerWrapper: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      marginBottom: 18,
      overflow: 'hidden',
      backgroundColor: theme.colors.card,
    },
    picker: {
      color: theme.colors.text,
      backgroundColor: 'transparent',
    },
    loader: { marginVertical: 12 },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      marginTop: 6,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    primaryButtonText: {
      color: theme.colors.buttonText,
      fontWeight: '700',
      fontSize: 16,
    },
    footerText: {
      marginTop: 28,
      textAlign: 'center',
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    linkButton: {
      marginTop: 8,
      paddingVertical: 6,
    },
    link: {
      color: theme.colors.accent,
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '600',
    },
  });
