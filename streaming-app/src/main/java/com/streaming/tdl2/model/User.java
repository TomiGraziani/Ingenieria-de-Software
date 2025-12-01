package com.streaming.tdl2.model;

import java.util.Objects;

public class User {
    private String name;
    private String email;
    private String password;
    private String dni;

    public User(String name, String email, String password, String dni) {
        this.name = name;
        this.email = email;
        this.password = password;
        this.dni = dni;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }

    public String getDni() {
        return dni;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        User user = (User) o;
        return Objects.equals(email, user.email);
    }

    @Override
    public int hashCode() {
        return Objects.hash(email);
    }
}
