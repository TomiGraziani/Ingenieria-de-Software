# Plataforma de Streaming TDL2 (POC)

Pequeña aplicación de escritorio en Java/Swing que implementa el flujo solicitado en el entregable 3: login/registro, bienvenida con carga de catálogo concurrente, calificación de películas y búsqueda en OMDb.

## Requisitos
- Java 17+
- Maven 3+
- Variable de entorno `OMDB_API_KEY` con tu key de https://www.omdbapi.com/apikey.aspx (opcional, se usa `demo` en caso de no definirla).

## Ejecución
```bash
mvn -DskipTests package
java -jar target/streaming-app-1.0.0.jar
```

Los usuarios y calificaciones se almacenan en `~/.streaming-tdl2` en formato JSON. El catálogo inicial se importa desde `src/main/resources/data/movies_database.csv` y se ordena por `rating_promedio` antes de mostrarse.
