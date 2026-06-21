from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    vector_database_service_url: str = "http://localhost:8004"
    text_service_url: str = "http://localhost:8001"
    request_timeout_seconds: float = 600.0
    memory_max_turns: int = 12
    data_dir: str = "/data"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
