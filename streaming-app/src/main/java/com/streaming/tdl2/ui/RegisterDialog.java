package com.streaming.tdl2.ui;

import javax.swing.*;
import java.awt.*;
import java.util.function.Consumer;

public class RegisterDialog extends JDialog {
    private final JTextField nameField = new JTextField(20);
    private final JTextField emailField = new JTextField(20);
    private final JPasswordField passwordField = new JPasswordField(20);
    private final JTextField dniField = new JTextField(10);

    public RegisterDialog(JFrame owner, Consumer<UserInput> onRegister) {
        super(owner, "Registrar usuario", true);
        setLayout(new BorderLayout(10, 10));

        JPanel form = new JPanel(new GridLayout(4, 2, 6, 6));
        form.add(new JLabel("Nombre completo:"));
        form.add(nameField);
        form.add(new JLabel("Email:"));
        form.add(emailField);
        form.add(new JLabel("Contraseña:"));
        form.add(passwordField);
        form.add(new JLabel("DNI:"));
        form.add(dniField);
        add(form, BorderLayout.CENTER);

        JButton registerBtn = new JButton("Crear cuenta");
        registerBtn.addActionListener(e -> {
            onRegister.accept(new UserInput(
                    nameField.getText(),
                    emailField.getText(),
                    new String(passwordField.getPassword()),
                    dniField.getText()
            ));
        });
        add(registerBtn, BorderLayout.SOUTH);
        pack();
        setLocationRelativeTo(owner);
    }

    public record UserInput(String name, String email, String password, String dni) {}
}
