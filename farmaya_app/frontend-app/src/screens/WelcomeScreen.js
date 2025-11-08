import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export default function WelcomeScreen({ navigation }) {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/logo.png')} // ✅ ruta corregida
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={[styles.title, { color: theme.colors.text }]}>
        Bienvenidos a FarmaYa
      </Text>

      <Text style={[styles.slogan, { color: theme.colors.textSecondary }]}>
        Tu farmacia de confianza, a domicilio
      </Text>

      <TouchableOpacity onPress={toggleTheme}>
        <Text style={{ color: theme.colors.primary, marginTop: 10 }}>
          Cambiar a modo {isDarkMode ? 'claro' : 'oscuro'}
        </Text>
      </TouchableOpacity>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>Iniciar Sesión</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.registerButton]}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.buttonText}>Registrarse</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  logoContainer: { marginBottom: 40 },
  logo: { width: 200, height: 200 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  slogan: { fontSize: 16, marginBottom: 40, textAlign: 'center' },
  buttonContainer: { width: '100%', gap: 15, marginTop: 10 },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    width: '100%',
  },
  registerButton: { backgroundColor: '#34C759' },
  buttonText: { color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
});
