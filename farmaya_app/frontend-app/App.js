import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';

// 🔹 Screens principales
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';


// 🔹 Screens de farmacia y repartidor
import AgregarProductoScreen from './src/screens/AgregarProductoScreen';
import EditarPerfilFarmaciaScreen from './src/screens/EditarPerfilFarmaciaScreen';
import HomeFarmaciaScreen from './src/screens/HomeFarmaciaScreen';
import HomeRepartidorScreen from './src/screens/HomeRepartidorScreen';
import MisPedidosScreen from './src/screens/MisPedidosScreen';
import PedidoActivoScreen from './src/screens/PedidoActivoScreen';
import PedidosFarmaciaScreen from './src/screens/PedidosFarmaciaScreen';
import ProfileFarmaciaScreen from './src/screens/ProfileFarmaciaScreen';
import RecordatoriosScreen from './src/screens/RecordatoriosScreen';
import VentasFarmaciaScreen from './src/screens/VentasFarmaciaScreen';

// 🔹 Mapa y productos
import BuscarFarmaciaScreen from './src/screens/BuscarFarmaciaScreen';
import ProductosFarmaciaScreen from './src/screens/ProductosFarmaciaScreen';

// 🔹 Tema global
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeProvider';

// Crear el Stack de navegación
const Stack = createNativeStackNavigator();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  useEffect(() => {
    // Ocultar todos los warnings y errores de la consola en la UI
    LogBox.ignoreAllLogs(true);

    const configureAndroidChannel = async () => {
      if (Platform.OS !== 'android') {
        return;
      }

      await Notifications.setNotificationChannelAsync('recordatorios', {
        name: 'Recordatorios',
        description: 'Recordatorios programados por el usuario',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    };

    configureAndroidChannel();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Welcome"
            screenOptions={{
              headerShown: false, // Oculta el header por defecto
            }}
          >
            {/* 🔹 Autenticación */}
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />

            {/* 🔹 Usuario Cliente */}
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />

            {/* 🔹 Farmacia */}
            <Stack.Screen name="HomeFarmacia" component={HomeFarmaciaScreen} />
            <Stack.Screen name="ProfileFarmacia" component={ProfileFarmaciaScreen} />
            <Stack.Screen name="PedidosFarmacia" component={PedidosFarmaciaScreen} />
            <Stack.Screen name="EditarPerfilFarmacia" component={EditarPerfilFarmaciaScreen} />
            <Stack.Screen name="AgregarProducto" component={AgregarProductoScreen} />
            <Stack.Screen name="VentasFarmacia" component={VentasFarmaciaScreen} />

            {/* 🔹 Repartidor */}
            <Stack.Screen name="HomeRepartidor" component={HomeRepartidorScreen} />
            <Stack.Screen name="PedidoActivo" component={PedidoActivoScreen} />

            {/* 🔹 Mapas y productos */}
            <Stack.Screen name="BuscarFarmacia" component={BuscarFarmaciaScreen} />
            <Stack.Screen name="ProductosFarmacia" component={ProductosFarmaciaScreen} />

            {/* 🔹 Historial de pedidos del cliente */}
            <Stack.Screen name="MisPedidos" component={MisPedidosScreen} screenOptions={{ headerShown: false, }} />
            <Stack.Screen name="Recordatorios" component={RecordatoriosScreen} screenOptions={{ headerShown: false, }} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>

  );
}
