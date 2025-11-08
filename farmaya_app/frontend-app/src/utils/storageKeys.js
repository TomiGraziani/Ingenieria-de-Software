import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_CLIENTE_ORDERS_KEY = "clienteOrders";

const safeParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error("Error parsing stored user for storage key:", error);
    return null;
  }
};

export const getClienteOrdersStorageKey = async () => {
  try {
    const storedUser = await AsyncStorage.getItem("user");
    const user = safeParse(storedUser);
    if (!user) {
      return DEFAULT_CLIENTE_ORDERS_KEY;
    }

    const identifier =
      user.id ??
      user.pk ??
      user.usuario_id ??
      user.usuario?.id ??
      user.usuario?.pk ??
      user.email ??
      user.username;

    if (!identifier) {
      return DEFAULT_CLIENTE_ORDERS_KEY;
    }

    const storageKey = `${DEFAULT_CLIENTE_ORDERS_KEY}:${identifier}`;

    if (storageKey !== DEFAULT_CLIENTE_ORDERS_KEY) {
      try {
        const [existingValue, legacyValue] = await Promise.all([
          AsyncStorage.getItem(storageKey),
          AsyncStorage.getItem(DEFAULT_CLIENTE_ORDERS_KEY),
        ]);

        if (!existingValue && legacyValue) {
          await AsyncStorage.setItem(storageKey, legacyValue);
          await AsyncStorage.removeItem(DEFAULT_CLIENTE_ORDERS_KEY);
        }
      } catch (migrationError) {
        console.error("Error migrating cliente orders storage key:", migrationError);
      }
    }

    return storageKey;
  } catch (error) {
    console.error("Error resolving cliente orders storage key:", error);
    return DEFAULT_CLIENTE_ORDERS_KEY;
  }
};

export default getClienteOrdersStorageKey;
