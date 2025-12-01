package com.streaming.tdl2.ui;

import com.streaming.tdl2.exception.ValidationException;
import com.streaming.tdl2.model.Movie;
import com.streaming.tdl2.model.User;
import com.streaming.tdl2.service.MovieService;
import com.streaming.tdl2.service.OmdbService;
import com.streaming.tdl2.service.OmdbService.OmdbMovie;
import com.streaming.tdl2.service.RatingService;

import javax.swing.*;
import java.awt.*;
import java.util.List;
import java.util.Optional;

public class WelcomePanel extends JPanel {
    private final MovieService movieService;
    private final RatingService ratingService;
    private final OmdbService omdbService = new OmdbService();
    private final Runnable logoutAction;
    private final MovieTableModel tableModel = new MovieTableModel();
    private final CardLayout cardLayout = new CardLayout();
    private final JPanel cardPanel = new JPanel(cardLayout);
    private final JTextArea overviewArea = new JTextArea(5, 30);
    private final JTextArea omdbArea = new JTextArea(4, 30);
    private final JLabel userLabel = new JLabel();
    private User currentUser;

    public WelcomePanel(MovieService movieService, RatingService ratingService, Runnable logoutAction) {
        this.movieService = movieService;
        this.ratingService = ratingService;
        this.logoutAction = logoutAction;
        setLayout(new BorderLayout(10, 10));
        add(buildHeader(), BorderLayout.NORTH);
        add(buildCenter(), BorderLayout.CENTER);
        add(buildFooter(), BorderLayout.SOUTH);
    }

    private JComponent buildHeader() {
        JPanel panel = new JPanel(new BorderLayout());
        JPanel userPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        userPanel.add(new JLabel("Usuario:"));
        userPanel.add(userLabel);
        panel.add(userPanel, BorderLayout.WEST);

        JPanel actions = new JPanel();
        JButton logoutButton = new JButton("Cerrar sesión");
        logoutButton.addActionListener(e -> logoutAction.run());
        actions.add(logoutButton);

        JTextField searchField = new JTextField(20);
        JButton searchButton = new JButton("Buscar en OMDb");
        searchButton.addActionListener(e -> searchMovie(searchField.getText()));
        actions.add(searchField);
        actions.add(searchButton);

        panel.add(actions, BorderLayout.EAST);
        return panel;
    }

    private JComponent buildCenter() {
        JPanel loading = new JPanel();
        loading.add(new JLabel("Un momento por favor... cargando catálogo"));

        JTable table = new JTable(tableModel);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        JScrollPane tableScroll = new JScrollPane(table);
        overviewArea.setEditable(false);
        overviewArea.setLineWrap(true);
        overviewArea.setWrapStyleWord(true);

        JPanel content = new JPanel(new BorderLayout(6, 6));
        content.add(tableScroll, BorderLayout.CENTER);
        content.add(new JScrollPane(overviewArea), BorderLayout.SOUTH);

        cardPanel.add(loading, "loading");
        cardPanel.add(content, "content");

        JButton rateButton = new JButton("Calificar película seleccionada");
        rateButton.addActionListener(e -> {
            int row = table.getSelectedRow();
            if (row >= 0) {
                Movie movie = tableModel.getMovieAt(row);
                overviewArea.setText(movie.getOverview());
                openRatingDialog(movie);
            }
        });

        JPanel wrapper = new JPanel(new BorderLayout(6, 6));
        wrapper.add(cardPanel, BorderLayout.CENTER);
        wrapper.add(rateButton, BorderLayout.SOUTH);
        return wrapper;
    }

    private JComponent buildFooter() {
        JPanel panel = new JPanel(new GridLayout(1, 1));
        omdbArea.setEditable(false);
        omdbArea.setLineWrap(true);
        omdbArea.setWrapStyleWord(true);
        panel.add(new JScrollPane(omdbArea));
        return panel;
    }

    public void setUser(User user) {
        this.currentUser = user;
        userLabel.setText(user.getName() + " (" + user.getEmail() + ")");
        loadMoviesAsync();
    }

    private void loadMoviesAsync() {
        cardLayout.show(cardPanel, "loading");
        SwingWorker<List<Movie>, Void> worker = new SwingWorker<>() {
            @Override
            protected List<Movie> doInBackground() throws Exception {
                return movieService.loadTopRated(10);
            }

            @Override
            protected void done() {
                try {
                    List<Movie> movies = get();
                    tableModel.setMovies(movies);
                    if (!movies.isEmpty()) {
                        overviewArea.setText(movies.get(0).getOverview());
                    }
                    cardLayout.show(cardPanel, "content");
                } catch (Exception e) {
                    showError("Error al cargar películas: " + e.getMessage());
                }
            }
        };
        worker.execute();
    }

    private void openRatingDialog(Movie movie) {
        RatingDialog dialog = new RatingDialog((JFrame) SwingUtilities.getWindowAncestor(this), movie.getTitle(), (score, review) -> {
            try {
                ratingService.rateMovie(movie.getId(), currentUser.getEmail(), score, review);
                JOptionPane.showMessageDialog(this, "Calificación guardada", "Éxito", JOptionPane.INFORMATION_MESSAGE);
            } catch (ValidationException ex) {
                showError(ex.getMessage());
            }
        });
        dialog.setVisible(true);
    }

    private void searchMovie(String title) {
        if (title == null || title.isBlank()) {
            showError("Ingrese un título para buscar");
            return;
        }
        Optional<OmdbMovie> result = omdbService.searchByTitle(title);
        if (result.isPresent()) {
            OmdbMovie movie = result.get();
            omdbArea.setText("Título: " + movie.title() + "\nAño: " + movie.year() + "\nSinopsis: " + movie.plot());
        } else {
            omdbArea.setText("Película no encontrada o error en la consulta");
        }
    }

    private void showError(String message) {
        JOptionPane.showMessageDialog(this, message, "Error", JOptionPane.ERROR_MESSAGE);
    }
}
