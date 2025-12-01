package com.streaming.tdl2.ui;

import javax.swing.*;
import java.awt.*;
import java.util.function.BiConsumer;

public class RatingDialog extends JDialog {
    private final JSpinner ratingSpinner = new JSpinner(new SpinnerNumberModel(3, 1, 5, 1));
    private final JTextArea reviewArea = new JTextArea(4, 20);

    public RatingDialog(JFrame owner, String movieTitle, BiConsumer<Integer, String> onSave) {
        super(owner, "Calificar " + movieTitle, true);
        setLayout(new BorderLayout(8, 8));

        JPanel form = new JPanel(new GridLayout(2, 2, 6, 6));
        form.add(new JLabel("Puntaje (1-5):"));
        form.add(ratingSpinner);
        form.add(new JLabel("Reseña:"));
        form.add(new JScrollPane(reviewArea));
        add(form, BorderLayout.CENTER);

        JButton saveButton = new JButton("Guardar");
        saveButton.addActionListener(e -> onSave.accept((Integer) ratingSpinner.getValue(), reviewArea.getText()));
        add(saveButton, BorderLayout.SOUTH);
        pack();
        setLocationRelativeTo(owner);
    }
}
