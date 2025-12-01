package com.streaming.tdl2.model;

public class Movie {
    private final String id;
    private final String title;
    private final String overview;
    private final String genre;
    private final int year;
    private final double averageRating;
    private final String posterUrl;

    public Movie(String id, String title, String overview, String genre, int year, double averageRating, String posterUrl) {
        this.id = id;
        this.title = title;
        this.overview = overview;
        this.genre = genre;
        this.year = year;
        this.averageRating = averageRating;
        this.posterUrl = posterUrl;
    }

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getOverview() {
        return overview;
    }

    public String getGenre() {
        return genre;
    }

    public int getYear() {
        return year;
    }

    public double getAverageRating() {
        return averageRating;
    }

    public String getPosterUrl() {
        return posterUrl;
    }
}
