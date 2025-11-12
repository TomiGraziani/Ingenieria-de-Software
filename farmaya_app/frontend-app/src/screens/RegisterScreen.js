import React, { useState } from 'react';
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
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api';
import { useTheme } from '../theme/ThemeProvider';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rol, setRol] = useState('cliente');
  const [direccion, setDireccion] = useState('');
  const [horarios, setHorarios] = useState('');
  const [telefono, setTelefono] = useState('');
  const [matricula, setMatricula] = useState('');
  const [mayorEdad, setMayorEdad] = useState(false);
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validateTelefono = (value) => /^(\+?\d[\d\s-]{6,})$/.test(value.trim());

  // Función para validar que solo contenga letras y espacios en blanco
  const validarNombre = (texto, textoAnterior) => {
    // Detecta si se intentó ingresar un número u otro carácter no válido
    const tieneNumerosOCaracteresEspeciales = /[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/.test(texto);

    if (tieneNumerosOCaracteresEspeciales) {
      Alert.alert('Error', 'No se admiten numeros en el nombre ingrese un nombre valido');
      // Mantener el texto anterior (sin los números)
      return textoAnterior || '';
    }

    // Si es válido, permitir el cambio
    return texto;
  };

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

      if (!matricula.trim()) {
        Alert.alert('Error', 'Ingresá el número de matrícula de la farmacia.');
        return;
      }
    }

    if (rol === 'repartidor') {
      if (!mayorEdad) {
        Alert.alert('Error', 'Debés declarar que sos mayor de 18 años para registrarte como repartidor.');
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

      if (rol === 'farmacia' && matricula.trim()) {
        payload.matricula = matricula.trim();
      }

      // 🔹 Petición al backend para registrar
      const response = await API.post('register/', payload);

      console.log('✅ Usuario registrado:', response.data);

      Alert.alert(
        '✅ Registro exitoso',
        'Tu cuenta ha sido creada correctamente. Por favor, inicia sesión para continuar.'
      );

      // 🔹 Redirigir a la pantalla de login
      navigation.replace('Login');
    } catch (error) {
      // No mostrar el error en consola para evitar que aparezca en la UI
      // console.error('❌ Error al registrar usuario:', error.response?.data || error);

      // Extraer mensaje de error del backend
      let errorMessage = 'No se pudo completar el registro. Intenta nuevamente.';

      if (error.response?.data) {
        const errorData = error.response.data;

        // Buscar mensajes de error en diferentes campos
        if (errorData.email && Array.isArray(errorData.email)) {
          errorMessage = errorData.email[0];
        } else if (errorData.nombre && Array.isArray(errorData.nombre)) {
          errorMessage = errorData.nombre[0];
        } else if (errorData.telefono && Array.isArray(errorData.telefono)) {
          errorMessage = errorData.telefono[0];
        } else if (errorData.matricula && Array.isArray(errorData.matricula)) {
          errorMessage = errorData.matricula[0];
        } else if (typeof errorData === 'object') {
          // Si es un objeto con múltiples campos, tomar el primer mensaje
          const firstKey = Object.keys(errorData)[0];
          if (firstKey && Array.isArray(errorData[firstKey])) {
            errorMessage = errorData[firstKey][0];
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      }

      // Mostrar solo el Alert, no el banner de error
      Alert.alert('Error', errorMessage);
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
          <Text style={styles.tagline}>Sumate a FarmaYa</Text>
          <Text style={styles.title}>Crear cuenta</Text>

          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            style={styles.input}
            placeholder="Cómo te llamas"
            placeholderTextColor={theme.colors.textSecondary}
            value={nombre}
            onChangeText={(text) => {
              const nombreValidado = validarNombre(text, nombre);
              setNombre(nombreValidado);
            }}
            autoCapitalize="words"
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
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Mínimo 6 caracteres"
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
              <Text style={styles.label}>Número de matrícula *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ingresá el número de matrícula"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="default"
                value={matricula}
                onChangeText={setMatricula}
              />

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

          {rol === 'repartidor' && (
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setMayorEdad(!mayorEdad)}
              >
                <Text style={styles.checkboxIcon}>{mayorEdad ? '☑️' : '☐'}</Text>
                <Text style={styles.checkboxLabel}>
                  Declaro ser mayor de 18 años
                </Text>
              </TouchableOpacity>
            </View>
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
    checkboxContainer: {
      marginBottom: 18,
    },
    checkbox: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    checkboxIcon: {
      fontSize: 20,
      marginRight: 10,
    },
    checkboxLabel: {
      fontSize: 14,
      color: theme.colors.text,
      flex: 1,
    },
  });
