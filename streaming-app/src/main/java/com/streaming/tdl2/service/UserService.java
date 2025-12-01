package com.streaming.tdl2.service;

import com.streaming.tdl2.dao.UserDao;
import com.streaming.tdl2.exception.UserAlreadyExistsException;
import com.streaming.tdl2.exception.ValidationException;
import com.streaming.tdl2.model.User;

import java.io.IOException;
import java.util.regex.Pattern;

public class UserService {
    private final UserDao userDao = new UserDao();
    private final Pattern emailPattern = Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$");

    public User register(String name, String email, String password, String dni) throws ValidationException, UserAlreadyExistsException {
        validateRegistration(name, email, password, dni);
        if (userDao.findByEmail(email).isPresent()) {
            throw new UserAlreadyExistsException("El usuario ya está registrado");
        }
        try {
            User user = new User(name.trim(), email.trim().toLowerCase(), password, dni.trim());
            userDao.save(user);
            return user;
        } catch (IOException e) {
            throw new ValidationException("No se pudo guardar el usuario: " + e.getMessage());
        }
    }

    public User login(String email, String password) throws ValidationException {
        if (email == null || password == null || email.isBlank() || password.isBlank()) {
            throw new ValidationException("Debe completar email y contraseña");
        }
        return userDao.findByEmail(email.trim().toLowerCase())
                .filter(user -> user.getPassword().equals(password))
                .orElseThrow(() -> new ValidationException("Usuario o contraseña incorrectos"));
    }

    private void validateRegistration(String name, String email, String password, String dni) throws ValidationException {
        if (name == null || name.isBlank() || email == null || email.isBlank() ||
                password == null || password.isBlank() || dni == null || dni.isBlank()) {
            throw new ValidationException("Todos los campos son obligatorios");
        }
        if (!emailPattern.matcher(email).matches()) {
            throw new ValidationException("El email no tiene un formato válido");
        }
        if (password.length() < 6) {
            throw new ValidationException("La contraseña debe tener al menos 6 caracteres");
        }
        if (!dni.matches("\\d{7,10}")) {
            throw new ValidationException("El DNI debe contener solo números");
        }
    }
}
