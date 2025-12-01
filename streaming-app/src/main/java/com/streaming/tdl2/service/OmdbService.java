package com.streaming.tdl2.service;

import org.json.JSONObject;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Optional;

public class OmdbService {
    public record OmdbMovie(String title, String year, String plot) {}

    private final HttpClient client = HttpClient.newHttpClient();
    private final String apiKey = System.getenv().getOrDefault("OMDB_API_KEY", "demo");

    public Optional<OmdbMovie> searchByTitle(String title) {
        try {
            String url = "https://www.omdbapi.com/?t=" + title.replace(" ", "+") + "&apikey=" + apiKey;
            HttpRequest request = HttpRequest.newBuilder().uri(URI.create(url)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            JSONObject json = new JSONObject(response.body());
            if (json.optString("Response").equalsIgnoreCase("True")) {
                return Optional.of(new OmdbMovie(
                        json.optString("Title", ""),
                        json.optString("Year", ""),
                        json.optString("Plot", "")
                ));
            }
        } catch (Exception e) {
            // ignored, se retornará vacío para mostrar feedback en UI
        }
        return Optional.empty();
    }
}
