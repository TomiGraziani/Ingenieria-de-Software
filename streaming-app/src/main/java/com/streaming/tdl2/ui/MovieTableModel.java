package com.streaming.tdl2.ui;

import com.streaming.tdl2.model.Movie;

import javax.swing.table.AbstractTableModel;
import java.util.ArrayList;
import java.util.List;

public class MovieTableModel extends AbstractTableModel {
    private final String[] columns = {"Título", "Género", "Año", "Rating prom."};
    private List<Movie> movies = new ArrayList<>();

    public void setMovies(List<Movie> movies) {
        this.movies = movies;
        fireTableDataChanged();
    }

    public Movie getMovieAt(int row) {
        return movies.get(row);
    }

    @Override
    public int getRowCount() {
        return movies.size();
    }

    @Override
    public int getColumnCount() {
        return columns.length;
    }

    @Override
    public String getColumnName(int column) {
        return columns[column];
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        Movie movie = movies.get(rowIndex);
        return switch (columnIndex) {
            case 0 -> movie.getTitle();
            case 1 -> movie.getGenre();
            case 2 -> movie.getYear();
            case 3 -> movie.getAverageRating();
            default -> "";
        };
    }
}
