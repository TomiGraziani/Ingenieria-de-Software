package com.streaming.tdl2.model;

public class Rating {
    private final String movieId;
    private final String userEmail;
    private final int score;
    private final String review;

    public Rating(String movieId, String userEmail, int score, String review) {
        this.movieId = movieId;
        this.userEmail = userEmail;
        this.score = score;
        this.review = review;
    }

    public String getMovieId() {
        return movieId;
    }

    public String getUserEmail() {
        return userEmail;
    }

    public int getScore() {
        return score;
    }

    public String getReview() {
        return review;
    }
}
