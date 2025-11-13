/**
 * Extrae mensajes de error amigables de las respuestas del backend
 * @param {Error} error - El error de axios
 * @returns {string} - Mensaje de error amigable
 */
export const extractErrorMessage = (error) => {
  // Mensaje por defecto
  let errorMessage = 'No se pudo completar la operación. Intenta nuevamente.';

  if (!error) {
    return errorMessage;
  }

  // Si hay respuesta del servidor
  if (error.response?.data) {
    const errorData = error.response.data;

    // Si es un objeto con campos de validación
    if (typeof errorData === 'object' && !Array.isArray(errorData)) {
      // Prioridad: email, nombre, dni, telefono, matricula, password, etc.
      const priorityFields = ['email', 'nombre', 'dni', 'telefono', 'matricula', 'password', 'direccion'];

      for (const field of priorityFields) {
        if (errorData[field]) {
          if (Array.isArray(errorData[field])) {
            errorMessage = errorData[field][0];
            break;
          } else if (typeof errorData[field] === 'string') {
            errorMessage = errorData[field];
            break;
          }
        }
      }

      // Si no se encontró en campos prioritarios, buscar el primer campo con error
      if (errorMessage === 'No se pudo completar la operación. Intenta nuevamente.') {
        const firstKey = Object.keys(errorData)[0];
        if (firstKey) {
          if (Array.isArray(errorData[firstKey])) {
            errorMessage = errorData[firstKey][0];
          } else if (typeof errorData[firstKey] === 'string') {
            errorMessage = errorData[firstKey];
          } else if (errorData[firstKey]?.detail) {
            errorMessage = errorData[firstKey].detail;
          }
        }
      }

      // Si hay un campo 'detail' directo
      if (errorData.detail && errorMessage === 'No se pudo completar la operación. Intenta nuevamente.') {
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail[0];
        }
      }

      // Si hay un campo 'message'
      if (errorData.message && errorMessage === 'No se pudo completar la operación. Intenta nuevamente.') {
        errorMessage = errorData.message;
      }
    }
    // Si es un string directo
    else if (typeof errorData === 'string') {
      errorMessage = errorData;
    }
    // Si es un array
    else if (Array.isArray(errorData) && errorData.length > 0) {
      errorMessage = errorData[0];
    }
  }
  // Si no hay respuesta pero hay un mensaje en el error
  else if (error.message) {
    // Solo usar el mensaje si no es un mensaje técnico genérico
    if (!error.message.includes('Network Error') && !error.message.includes('timeout')) {
      errorMessage = error.message;
    } else {
      errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
    }
  }

  // Mejorar mensajes comunes del backend
  const messageMap = {
    'Ya existe un/a usuario con este/a Correo electrónico.': 'Este correo electrónico ya está en uso.',
    'Ya existe un/a usuario con este/a nombre.': 'Este nombre ya está en uso.',
    'Ya existe un/a usuario con este/a correo electrónico.': 'Este correo electrónico ya está en uso.',
    'Ya existe un usuario registrado con este DNI.': 'Este DNI ya está registrado.',
    'El DNI solo debe contener números.': 'El DNI solo debe contener números.',
    'El DNI debe tener 7, 8 o 10 dígitos.': 'El DNI debe tener 7, 8 o 10 dígitos.',
    'El DNI es obligatorio para clientes y repartidores.': 'El DNI es obligatorio.',
    'Ya existe una farmacia registrada con esta matrícula.': 'Esta matrícula ya está registrada.',
    'Ya existe un usuario con este teléfono.': 'Este teléfono ya está en uso.',
    'Las farmacias deben proporcionar un teléfono de contacto.': 'Las farmacias deben proporcionar un teléfono de contacto.',
    'Las farmacias deben proporcionar un número de matrícula.': 'Las farmacias deben proporcionar un número de matrícula.',
  };

  // Aplicar mapeo de mensajes si existe
  if (messageMap[errorMessage]) {
    errorMessage = messageMap[errorMessage];
  }

  return errorMessage;
};

