import os
import sys
import json
import numpy as np

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add parent directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ml_training.training.dataset_loader import DatasetLoader
from ml_training.evaluation.metrics import compute_classification_metrics, format_metrics_report

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "config.json")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
EVAL_DIR = os.path.dirname(__file__)

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def evaluate_keras_model(model_path=None):
    config = load_config()
    if model_path is None:
        model_path = os.path.join(MODEL_DIR, "lifeguard_audio_classifier.keras")

    if not os.path.exists(model_path):
        print(f"[!] Model file not found: {model_path}")
        return None

    import tensorflow as tf
    print(f"Loading trained model: {model_path}")
    model = tf.keras.models.load_model(model_path)

    loader = DatasetLoader(config=config)
    X_test, y_test, file_paths = loader.load_split("test", augment=False)

    if len(X_test) == 0:
        print("[!] No test samples found to evaluate.")
        return None

    print(f"Running inference on {len(X_test)} holdout test samples...")
    raw_predictions = model.predict(X_test, verbose=0)
    y_pred = np.argmax(raw_predictions, axis=1)

    metrics = compute_classification_metrics(y_test, y_pred, config["classes"])
    report_text = format_metrics_report(metrics, config["classes"])
    print(report_text)

    # Save metrics JSON
    metrics_json_path = os.path.join(EVAL_DIR, "test_metrics.json")
    with open(metrics_json_path, "w") as f:
        json.dump(metrics, f, indent=2)

    # Save text report
    report_path = os.path.join(EVAL_DIR, "evaluation_report.txt")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_text)

    print(f"[OK] Evaluation report saved to: {report_path}")
    return metrics

def evaluate_tflite_model(tflite_path=None):
    config = load_config()
    if tflite_path is None:
        tflite_path = os.path.join(MODEL_DIR, "lifeguard_audio_classifier.tflite")

    if not os.path.exists(tflite_path):
        print(f"[!] TFLite model not found: {tflite_path}")
        return None

    import tensorflow as tf
    interpreter = tf.lite.Interpreter(model_path=tflite_path)
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    loader = DatasetLoader(config=config)
    X_test, y_test, _ = loader.load_split("test", augment=False)

    if len(X_test) == 0:
        return None

    y_pred = []
    for sample in X_test:
        input_data = np.expand_dims(sample, axis=0).astype(input_details[0]["dtype"])
        interpreter.set_tensor(input_details[0]["index"], input_data)
        interpreter.invoke()
        output_data = interpreter.get_tensor(output_details[0]["index"])[0]
        y_pred.append(np.argmax(output_data))

    metrics = compute_classification_metrics(y_test, y_pred, config["classes"])
    print("\n--- TFLITE ON-DEVICE MODEL EVALUATION ---")
    print(format_metrics_report(metrics, config["classes"]))
    return metrics

if __name__ == "__main__":
    evaluate_keras_model()
