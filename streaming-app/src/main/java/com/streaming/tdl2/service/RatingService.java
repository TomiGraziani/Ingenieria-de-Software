package com.streaming.tdl2.service;

import com.streaming.tdl2.dao.RatingDao;
import com.streaming.tdl2.exception.ValidationException;
import com.streaming.tdl2.model.Rating;

import java.io.IOException;
import java.util.List;

public class RatingService {
    private final RatingDao ratingDao = new RatingDao();

    public Rating rateMovie(String movieId, String userEmail, int score, String review) throws ValidationException {
        if (movieId == null || movieId.isBlank() || userEmail == null || userEmail.isBlank()) {
            throw new ValidationException("Datos de usuario o película inválidos");
        }
        if (score < 1 || score > 5) {
            throw new ValidationException("La calificación debe estar entre 1 y 5");
        }
        if (review == null || review.isBlank()) {
            throw new ValidationException("Debe ingresar una reseña");
        }
        Rating rating = new Rating(movieId, userEmail, score, review.trim());
        try {
            ratingDao.save(rating);
            return rating;
        } catch (IOException e) {
            throw new ValidationException("No se pudo guardar la calificación: " + e.getMessage());
        }
    }

    public List<Rating> getRatingsForUser(String email) {
        return ratingDao.findByUser(email);
    }
}
