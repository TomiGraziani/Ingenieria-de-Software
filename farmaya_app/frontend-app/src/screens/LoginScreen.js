import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import API from '../api/api';
import { useTheme } from '../theme/ThemeProvider';
import ErrorModal from '../components/ErrorModal';
import { extractErrorMessage } from '../utils/errorHandler';

export default function LoginScreen({ navigation }) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const styles = createStyles(theme);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePassword = (password) => password.length >= 6;

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor complete todos los campos');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Error', 'Por favor ingrese un email válido');
      return;
    }
    if (!validatePassword(password)) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      setLoading(true);

      // 🔹 Petición al backend (JWT login)
      const response = await API.post('login/', { email, password });
      const { access, refresh } = response.data;

      // 🔹 Guardar tokens
      await AsyncStorage.setItem('accessToken', access);
      await AsyncStorage.setItem('refreshToken', refresh);

      // 🔹 Obtener datos del usuario autenticado
      const userResponse = await API.get('usuarios/me/', {
        headers: { Authorization: `Bearer ${access}` },
      });

      const user = userResponse.data;
      await AsyncStorage.setItem('user', JSON.stringify(user));

      Alert.alert('✅ Inicio de sesión exitoso');

      // 🔹 Redirección según tipo de usuario
      if (user.tipo_usuario === 'farmacia') {
        navigation.replace('HomeFarmacia');
      } else if (user.tipo_usuario === 'repartidor') {
        navigation.replace('HomeRepartidor');
      } else {
        navigation.replace('Home');
      }
    } catch (error) {
      // Extraer mensaje de error amigable del backend
      let friendlyMessage = 'No se pudo conectar con el servidor.';

      if (error.response?.status === 401) {
        friendlyMessage = 'Email o contraseña inválidos.';
      } else {
        friendlyMessage = extractErrorMessage(error);
      }

      // Mostrar el modal de error en lugar del Alert
      setErrorMessage(friendlyMessage);
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.tagline}>Bienvenido de nuevo</Text>
          <Text style={styles.title}>Iniciar sesión</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Ingresá tu correo"
            placeholderTextColor={theme.colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Ingresá tu contraseña"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.passwordToggleText}>
                {showPassword ? '🙈' : '👁️'}
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
              <Text style={styles.primaryButtonText}>Ingresar</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.footerText}>¿No tenés cuenta?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkButton}>
            <Text style={styles.link}>Registrate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <ErrorModal
        visible={errorModalVisible}
        message={errorMessage}
        onClose={() => setErrorModalVisible(false)}
      />
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
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      padding: 28,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 5,
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
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      color: theme.colors.text,
      marginBottom: 24,
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
      fontSize: 16,
      backgroundColor: theme.colors.card,
      marginBottom: 18,
      color: theme.colors.text,
    },
    loader: { marginVertical: 18 },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
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
    passwordContainer: {
      position: 'relative',
      marginBottom: 18,
    },
    passwordInput: {
      paddingRight: 50,
      marginBottom: 0,
    },
    passwordToggle: {
      position: 'absolute',
      right: 12,
      top: 12,
      padding: 4,
    },
    passwordToggleText: {
      fontSize: 20,
    },
  });
