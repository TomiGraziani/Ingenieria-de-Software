import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";

// 🌐 Dirección base del backend Django
// ⚠️ Usá tu IP local (la de tu PC con el backend encendido)
const API = axios.create({
  baseURL: "http://192.168.0.7:8000/api/", // ✅ agregado el puerto 8000
  timeout: 10000,
});

// ============================================================
// 🔹 1️⃣ Interceptor de REQUEST
//    Agrega automáticamente el access token a cada request
// ============================================================
API.interceptors.request.use(
  async (config) => {
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// 🔹 2️⃣ Interceptor de RESPONSE
//    Si el access token expira (401), intenta refrescarlo
// ============================================================
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No hay refresh token almacenado");

        // 🔹 Solicita un nuevo access token
        const response = await axios.post("http://192.168.0.7:8000/api/token/refresh/", {
          refresh: refreshToken,
        });

        const newAccess = response.data.access;
        await AsyncStorage.setItem("accessToken", newAccess);

        // 🔹 Repite la request original con el nuevo token
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return API(originalRequest);
      } catch (refreshError) {
        console.error("Error al refrescar el token:", refreshError);
        await AsyncStorage.multiRemove(["accessToken", "refreshToken", "user"]);
        Alert.alert("Sesión expirada", "Por favor, inicia sesión nuevamente.");
      }
    }

    return Promise.reject(error);
  }
);

// ============================================================
// 🔹 3️⃣ Funciones helper (para usar en tus pantallas)
// ============================================================

// 🔐 Login
export const login = async (email, password) => {
  return await API.post("login/", { email, password });
};

// 📝 Registro
export const register = async (data) => {
  return await API.post("register/", data);
};

// 👤 Perfil del usuario autenticado
export const getUserProfile = async () => {
  return await API.get("usuarios/me/");
};

// 🏥 Listado de farmacias
export const getFarmacias = async () => {
  return await API.get("usuarios/farmacias/");
};

// Exporta la instancia principal
export default API;
