import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';

const REMINDERS_KEY = 'medicationReminders';

const formatDateTime = (date) => {
  if (!date) return 'Fecha sin definir';
  const instance = new Date(date);
  if (Number.isNaN(instance.getTime())) {
    return date;
  }

  const options = { hour: '2-digit', minute: '2-digit' };
  return `${instance.toLocaleDateString()} · ${instance.toLocaleTimeString([], options)}`;
};

const createStyles = (theme, insets) => {
  const bottomInset = insets?.bottom ?? 0;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: Math.max(bottomInset, 24),
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 8,
      lineHeight: 20,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 24,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
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
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.colors.text,
      backgroundColor: theme.colors.card,
      marginBottom: 16,
    },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    pickerText: {
      fontSize: 15,
      color: theme.colors.text,
      fontWeight: '500',
    },
    pickerHint: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    actionButton: {
      marginTop: 18,
      backgroundColor: theme.colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    actionButtonText: {
      fontSize: 16,
      color: '#fff',
      fontWeight: '600',
    },
    listHeader: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    reminderCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      padding: 16,
      backgroundColor: theme.colors.card,
      marginBottom: 12,
    },
    reminderTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    reminderDate: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 6,
    },
    cancelButton: {
      marginTop: 12,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: '#EF5350',
    },
    cancelButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 13,
    },
    emptyState: {
      paddingVertical: 32,
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 6,
      textAlign: 'center',
    },
    iosPicker: {
      marginTop: 16,
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
  });
};

export default function RecordatoriosScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const initial = new Date();
    initial.setMinutes(initial.getMinutes() + 10);
    return initial;
  });
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [reminders, setReminders] = useState([]);

  const ensurePermissions = useCallback(async () => {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }

    const request = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: true,
      },
      android: {
        allowAlert: true,
        allowSound: true,
        allowBadge: true,
      },
    });

    if (!request.granted) {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos permiso para enviarte recordatorios programados. Por favor, activá las notificaciones en la configuración de la app.'
      );
      return false;
    }

    return true;
  }, []);

  const persistReminders = useCallback(async (nextReminders) => {
    try {
      await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(nextReminders));
    } catch (error) {
      console.error('No se pudieron guardar los recordatorios:', error);
    }
  }, []);

  const loadReminders = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(REMINDERS_KEY);
      if (!stored) {
        setReminders([]);
        return;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        setReminders([]);
        return;
      }

      const futureReminders = parsed
        .map((item) => ({ ...item, date: item.date || item.fecha }))
        .filter((item) => {
          if (!item?.date) return false;
          const date = new Date(item.date);
          return !Number.isNaN(date.getTime()) && date.getTime() > Date.now() - 60 * 1000;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setReminders(futureReminders);
      persistReminders(futureReminders);
    } catch (error) {
      console.error('Error cargando recordatorios:', error);
      setReminders([]);
    }
  }, [persistReminders]);

  const handleScheduleReminder = useCallback(async () => {
    const hasPermission = await ensurePermissions();
    if (!hasPermission) {
      return;
    }

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      Alert.alert('Ingresá un recordatorio', 'Indicá qué querés recordar.');
      return;
    }

    const now = new Date();
    if (selectedDate <= now) {
      Alert.alert('Seleccioná una fecha futura', 'La fecha del recordatorio debe ser posterior al momento actual.');
      return;
    }

    try {
      // Asegurar que el canal esté configurado en Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('recordatorios', {
          name: 'Recordatorios',
          description: 'Recordatorios programados por el usuario',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Recordatorio de medicación',
          body: normalizedTitle,
          sound: 'default',
          data: { reminderId: Date.now().toString() },
          ...(Platform.OS === 'android' && { channelId: 'recordatorios' }),
        },
        trigger: {
          date: selectedDate,
        },
      });

      const nextReminders = [
        ...reminders,
        { id: identifier, title: normalizedTitle, date: selectedDate.toISOString() },
      ].sort((a, b) => new Date(a.date) - new Date(b.date));

      setReminders(nextReminders);
      persistReminders(nextReminders);
      setTitle('');
      setShowIosPicker(false);
      Alert.alert('Recordatorio creado', 'Te avisaremos en la fecha programada.');
    } catch (error) {
      console.error('No se pudo programar el recordatorio:', error);
      Alert.alert('Error', 'No pudimos crear el recordatorio. Intentá nuevamente.');
    }
  }, [ensurePermissions, persistReminders, reminders, selectedDate, title]);

  const handleCancelReminder = useCallback(
    async (identifier) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      } catch (error) {
        console.error('No se pudo cancelar la notificación programada:', error);
      }

      const nextReminders = reminders.filter((item) => item.id !== identifier);
      setReminders(nextReminders);
      persistReminders(nextReminders);
    },
    [persistReminders, reminders]
  );

  const openPicker = useCallback(() => {
    if (Platform.OS === 'android') {
      // Primero abrir el selector de fecha
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: 'date',
        minimumDate: new Date(),
        onChange: (event, date) => {
          if (event.type === 'set' && date) {
            // Guardar la fecha seleccionada temporalmente
            const newDate = new Date(date);
            newDate.setHours(selectedDate.getHours());
            newDate.setMinutes(selectedDate.getMinutes());
            newDate.setSeconds(0);
            newDate.setMilliseconds(0);

            // Abrir el selector de hora inmediatamente después
            setTimeout(() => {
              DateTimePickerAndroid.open({
                value: newDate,
                mode: 'time',
                is24Hour: true,
                onChange: (timeEvent, timeDate) => {
                  if (timeEvent.type === 'set' && timeDate) {
                    // Combinar la fecha seleccionada con la hora seleccionada
                    const finalDate = new Date(date);
                    finalDate.setHours(timeDate.getHours());
                    finalDate.setMinutes(timeDate.getMinutes());
                    finalDate.setSeconds(0);
                    finalDate.setMilliseconds(0);
                    setSelectedDate(finalDate);
                  }
                },
              });
            }, 500);
          }
        },
      });
    } else {
      setShowIosPicker(true);
    }
  }, [selectedDate]);

  useEffect(() => {
    navigation.setOptions({ headerShown: true, title: 'Recordatorios' });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadReminders();
    }, [loadReminders])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Programá tus recordatorios</Text>
        <Text style={styles.subtitle}>
          Configurá alertas para no olvidar tus medicamentos o tareas importantes.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>¿Qué debemos recordarte?</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Tomar la pastilla de la tarde"
          placeholderTextColor={theme.colors.textSecondary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>¿Cuándo querés que te avisemos?</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={openPicker}>
          <View>
            <Text style={styles.pickerText}>{formatDateTime(selectedDate)}</Text>
            <Text style={styles.pickerHint}>Tocá para elegir fecha y hora</Text>
          </View>
          <Text style={styles.pickerText}>📅</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && showIosPicker ? (
          <View style={styles.iosPicker}>
            <DateTimePicker
              value={selectedDate}
              mode="datetime"
              display="spinner"
              minimumDate={new Date()}
              onChange={(_event, date) => {
                if (date) {
                  setSelectedDate(date);
                }
              }}
            />
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowIosPicker(false)}>
              <Text style={styles.actionButtonText}>Listo</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity style={styles.actionButton} onPress={handleScheduleReminder}>
          <Text style={styles.actionButtonText}>Guardar recordatorio</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.listHeader}>Recordatorios programados</Text>

      {reminders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Todavía no tenés recordatorios</Text>
          <Text style={styles.emptySubtitle}>
            Agregá un recordatorio para recibir una notificación en la fecha que elijas.
          </Text>
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.reminderCard}>
              <Text style={styles.reminderTitle}>{item.title}</Text>
              <Text style={styles.reminderDate}>{formatDateTime(item.date)}</Text>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => handleCancelReminder(item.id)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
