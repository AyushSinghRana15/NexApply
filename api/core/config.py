from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    groq_api_key: str = ""
    redis_url: str = "redis://localhost:6379"
    database_url: str = "sqlite:///./nexapply.db"
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    environment: str = "development"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
