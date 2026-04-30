from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Mulher Viva API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/topics")
def topics() -> dict:
    return {
        "topics": [
            "Ciclo menstrual",
            "Menopausa",
            "Saude emocional",
            "Autocuidado",
        ]
    }
