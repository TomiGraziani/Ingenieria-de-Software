package com.streaming.tdl2;

import com.streaming.tdl2.service.MovieService;
import com.streaming.tdl2.service.UserService;
import com.streaming.tdl2.ui.StreamingAppFrame;

import javax.swing.SwingUtilities;

public class App {
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            MovieService movieService = new MovieService();
            UserService userService = new UserService();
            StreamingAppFrame frame = new StreamingAppFrame(movieService, userService);
            frame.setVisible(true);
        });
    }
}
