from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "compact-gpu-document-service"
    app_version: str = "1.0.0"
    request_max_pages: int = 30
    pdf_render_dpi: int = 160
    visual_model_name: str = "Salesforce/blip-image-captioning-base"
    ocr_languages: list[str] = ["en"]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
