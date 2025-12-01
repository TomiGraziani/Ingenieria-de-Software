package com.streaming.tdl2.dao;

import com.streaming.tdl2.model.User;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class UserDao {
    private final LocalDatabase database = LocalDatabase.getInstance();
    private final List<User> cache;

    public UserDao() {
        try {
            this.cache = new ArrayList<>(database.loadUsers());
        } catch (IOException e) {
            throw new RuntimeException("No se pudieron cargar los usuarios", e);
        }
    }

    public Optional<User> findByEmail(String email) {
        return cache.stream().filter(u -> u.getEmail().equalsIgnoreCase(email)).findFirst();
    }

    public void save(User user) throws IOException {
        cache.add(user);
        database.saveUsers(cache);
    }
}
