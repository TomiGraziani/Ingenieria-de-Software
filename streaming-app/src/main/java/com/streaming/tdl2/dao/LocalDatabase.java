package com.streaming.tdl2.dao;

import com.streaming.tdl2.model.Rating;
import com.streaming.tdl2.model.User;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

public class LocalDatabase {
    private static final String STORAGE_DIR = System.getProperty("user.home") + "/.streaming-tdl2";
    private static final String USERS_FILE = STORAGE_DIR + "/users.json";
    private static final String RATINGS_FILE = STORAGE_DIR + "/ratings.json";
    private static LocalDatabase instance;

    private LocalDatabase() {
        ensureFiles();
    }

    public static synchronized LocalDatabase getInstance() {
        if (instance == null) {
            instance = new LocalDatabase();
        }
        return instance;
    }

    public List<User> loadUsers() throws IOException {
        JSONArray array = new JSONArray(Files.readString(Paths.get(USERS_FILE)));
        List<User> users = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            JSONObject obj = array.getJSONObject(i);
            users.add(new User(
                    obj.getString("name"),
                    obj.getString("email"),
                    obj.getString("password"),
                    obj.getString("dni")
            ));
        }
        return users;
    }

    public void saveUsers(List<User> users) throws IOException {
        JSONArray array = new JSONArray();
        users.forEach(user -> {
            JSONObject obj = new JSONObject();
            obj.put("name", user.getName());
            obj.put("email", user.getEmail());
            obj.put("password", user.getPassword());
            obj.put("dni", user.getDni());
            array.put(obj);
        });
        Files.writeString(Paths.get(USERS_FILE), array.toString(2));
    }

    public List<Rating> loadRatings() throws IOException {
        JSONArray array = new JSONArray(Files.readString(Paths.get(RATINGS_FILE)));
        List<Rating> ratings = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            JSONObject obj = array.getJSONObject(i);
            ratings.add(new Rating(
                    obj.getString("movieId"),
                    obj.getString("userEmail"),
                    obj.getInt("score"),
                    obj.getString("review")
            ));
        }
        return ratings;
    }

    public void saveRatings(List<Rating> ratings) throws IOException {
        JSONArray array = new JSONArray();
        ratings.forEach(rating -> {
            JSONObject obj = new JSONObject();
            obj.put("movieId", rating.getMovieId());
            obj.put("userEmail", rating.getUserEmail());
            obj.put("score", rating.getScore());
            obj.put("review", rating.getReview());
            array.put(obj);
        });
        Files.writeString(Paths.get(RATINGS_FILE), array.toString(2));
    }

    private void ensureFiles() {
        try {
            Files.createDirectories(Path.of(STORAGE_DIR));
            Path users = Paths.get(USERS_FILE);
            Path ratings = Paths.get(RATINGS_FILE);
            if (Files.notExists(users)) {
                Files.writeString(users, "[]");
            }
            if (Files.notExists(ratings)) {
                Files.writeString(ratings, "[]");
            }
        } catch (IOException e) {
            throw new RuntimeException("No se pudo inicializar el almacenamiento local", e);
        }
    }
}
