package com.streaming.tdl2.dao;

import com.streaming.tdl2.model.Rating;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class RatingDao {
    private final LocalDatabase database = LocalDatabase.getInstance();
    private final List<Rating> cache;

    public RatingDao() {
        try {
            this.cache = new ArrayList<>(database.loadRatings());
        } catch (IOException e) {
            throw new RuntimeException("No se pudieron cargar las calificaciones", e);
        }
    }

    public List<Rating> findByUser(String email) {
        return cache.stream().filter(r -> r.getUserEmail().equalsIgnoreCase(email)).collect(Collectors.toList());
    }

    public void save(Rating rating) throws IOException {
        cache.add(rating);
        database.saveRatings(cache);
    }
}
