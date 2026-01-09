"""ImmichVR AI Service - Depth Converter."""

from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "service": "ai"})


@app.route("/", methods=["GET"])
def index():
    """Root endpoint."""
    return jsonify({"message": "ImmichVR AI Service", "version": "1.0.0"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
