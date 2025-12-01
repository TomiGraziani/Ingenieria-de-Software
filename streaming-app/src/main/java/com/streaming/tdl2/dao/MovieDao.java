package com.streaming.tdl2.dao;

import com.streaming.tdl2.model.Movie;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class MovieDao {
    private final List<Movie> movies = new ArrayList<>();

    public void save(Movie movie) {
        movies.add(movie);
    }

    public List<Movie> findAll() {
        return new ArrayList<>(movies);
    }

    public Optional<Movie> findById(String id) {
        return movies.stream().filter(m -> m.getId().equals(id)).findFirst();
    }

    public boolean isEmpty() {
        return movies.isEmpty();
    }
}
