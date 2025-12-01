package com.streaming.tdl2.service;

import com.streaming.tdl2.dao.MovieDao;
import com.streaming.tdl2.exception.MovieImportException;
import com.streaming.tdl2.model.Movie;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

public class MovieService {
    private final MovieDao movieDao = new MovieDao();
    private boolean imported = false;

    public synchronized void ensureMoviesLoaded() throws MovieImportException {
        if (imported) {
            return;
        }
        importFromCsv();
        imported = true;
    }

    public List<Movie> loadTopRated(int limit) throws MovieImportException {
        ensureMoviesLoaded();
        return movieDao.findAll().stream()
                .sorted(Comparator.comparingDouble(Movie::getAverageRating).reversed())
                .limit(limit)
                .collect(Collectors.toList());
    }

    public Optional<Movie> findById(String movieId) {
        return movieDao.findById(movieId);
    }

    private void importFromCsv() throws MovieImportException {
        if (!movieDao.isEmpty()) {
            return;
        }
        try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream("data/movies_database.csv")) {
            if (inputStream == null) {
                throw new MovieImportException("No se encontró el archivo de películas", null);
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
                String line = reader.readLine(); // header
                while ((line = reader.readLine()) != null) {
                    String[] values = line.split(",", 7);
                    if (values.length < 7) {
                        continue;
                    }
                    String id = values[0].trim();
                    String title = values[1].trim();
                    String overview = values[2].trim();
                    String genres = values[3].trim();
                    String genre = genres.contains("|") ? genres.split("\\|")[0] : genres;
                    int year = Integer.parseInt(values[4].trim());
                    double rating = Double.parseDouble(values[5].trim());
                    String poster = values[6].trim();
                    movieDao.save(new Movie(id, title, overview, genre, year, rating, poster));
                }
            }
        } catch (IOException | NumberFormatException e) {
            throw new MovieImportException("Error al importar películas", e);
        }
    }
}
