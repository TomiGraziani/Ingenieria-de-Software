package com.streaming.tdl2.ui;

import javax.swing.*;
import java.awt.*;

public class LoginPanel extends JPanel {
    public interface LoginListener {
        void onLogin(String email, String password);
        void onRegisterRequest();
    }

    private final JTextField emailField = new JTextField(20);
    private final JPasswordField passwordField = new JPasswordField(20);

    public LoginPanel(LoginListener listener) {
        setLayout(new BorderLayout(10, 10));
        JLabel title = new JLabel("Plataforma de Streaming TDL2", SwingConstants.CENTER);
        title.setFont(title.getFont().deriveFont(Font.BOLD, 18f));
        add(title, BorderLayout.NORTH);

        JPanel form = new JPanel(new GridLayout(2, 2, 8, 8));
        form.add(new JLabel("Email:"));
        form.add(emailField);
        form.add(new JLabel("Contraseña:"));
        form.add(passwordField);
        add(form, BorderLayout.CENTER);

        JPanel actions = new JPanel();
        JButton loginButton = new JButton("Ingresar");
        loginButton.addActionListener(e -> listener.onLogin(emailField.getText(), new String(passwordField.getPassword())));
        JButton registerButton = new JButton("Registrarse");
        registerButton.addActionListener(e -> listener.onRegisterRequest());
        actions.add(loginButton);
        actions.add(registerButton);
        add(actions, BorderLayout.SOUTH);
    }
}
