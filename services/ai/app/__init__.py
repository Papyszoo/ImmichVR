import logging
from flask import Flask
from .config import Config
from .models.depth_model import model

# Import blueprints
from .routes import health_bp, depth_bp, models_bp, splat_bp

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    # Register Blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(depth_bp)
    app.register_blueprint(models_bp)
    app.register_blueprint(splat_bp)
    
    # Initialize Model on startup with default model
    logger.info(f"Initializing application with default model: {Config.DEFAULT_MODEL}")
    model.initialize(Config.DEFAULT_MODEL)
        
    return app
