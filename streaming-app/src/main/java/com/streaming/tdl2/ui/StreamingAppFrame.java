package com.streaming.tdl2.ui;

import com.streaming.tdl2.exception.UserAlreadyExistsException;
import com.streaming.tdl2.exception.ValidationException;
import com.streaming.tdl2.model.User;
import com.streaming.tdl2.service.MovieService;
import com.streaming.tdl2.service.RatingService;
import com.streaming.tdl2.service.UserService;

import javax.swing.*;
import java.awt.*;

public class StreamingAppFrame extends JFrame implements LoginPanel.LoginListener {
    private final UserService userService;
    private final MovieService movieService;
    private final RatingService ratingService = new RatingService();
    private final CardLayout cardLayout = new CardLayout();
    private final JPanel container = new JPanel(cardLayout);
    private final LoginPanel loginPanel;
    private final WelcomePanel welcomePanel;

    public StreamingAppFrame(MovieService movieService, UserService userService) {
        super("Streaming TDL2");
        this.userService = userService;
        this.movieService = movieService;
        this.loginPanel = new LoginPanel(this);
        this.welcomePanel = new WelcomePanel(movieService, ratingService, this::logout);
        container.add(loginPanel, "login");
        container.add(welcomePanel, "welcome");
        setContentPane(container);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(900, 600);
        setLocationRelativeTo(null);
    }

    @Override
    public void onLogin(String email, String password) {
        try {
            User user = userService.login(email, password);
            welcomePanel.setUser(user);
            cardLayout.show(container, "welcome");
        } catch (ValidationException e) {
            showError(e.getMessage());
        }
    }

    @Override
    public void onRegisterRequest() {
        RegisterDialog dialog = new RegisterDialog(this, input -> {
            try {
                userService.register(input.name(), input.email(), input.password(), input.dni());
                JOptionPane.showMessageDialog(this, "Usuario registrado con éxito", "Éxito", JOptionPane.INFORMATION_MESSAGE);
            } catch (ValidationException | UserAlreadyExistsException e) {
                showError(e.getMessage());
            }
        });
        dialog.setVisible(true);
    }

    private void logout() {
        cardLayout.show(container, "login");
    }

    private void showError(String message) {
        JOptionPane.showMessageDialog(this, message, "Error", JOptionPane.ERROR_MESSAGE);
    }
}
