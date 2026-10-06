import os
import sys
import shutil
import json
import numpy as np

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "config.json")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "app", "src", "main", "assets"))

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def convert_model(keras_model_path=None, quantize=True):
    import tensorflow as tf

    if keras_model_path is None:
        keras_model_path = os.path.join(MODEL_DIR, "lifeguard_audio_classifier.keras")

    if not os.path.exists(keras_model_path):
        print(f"[!] Error: Keras model not found at {keras_model_path}")
        return None

    print("=" * 60)
    print(" CONVERTING MODEL TO TENSORFLOW LITE (.tflite)")
    print("=" * 60)
    print(f"Source Model: {keras_model_path}")

    model = tf.keras.models.load_model(keras_model_path)
    converter = tf.lite.TFLiteConverter.from_keras_model(model)

    if quantize:
        print("Applying dynamic-range quantization optimization...")
        converter.optimizations = [tf.lite.Optimize.DEFAULT]

    tflite_model = converter.convert()

    # Save to ml_training/models/
    tflite_path = os.path.join(MODEL_DIR, "lifeguard_audio_classifier.tflite")
    with open(tflite_path, "wb") as f:
        f.write(tflite_model)
    model_size_kb = len(tflite_model) / 1024.0
    print(f"[OK] TFLite model generated: {tflite_path} ({model_size_kb:.2f} KB)")

    # Validate TFLite model with test invocation
    print("Verifying TFLite model invocation with test tensor...")
    interpreter = tf.lite.Interpreter(model_content=tflite_model)
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    dummy_input = np.zeros(input_details[0]["shape"], dtype=input_details[0]["dtype"])
    interpreter.set_tensor(input_details[0]["index"], dummy_input)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details[0]["index"])
    print(f"[OK] Verification successful. Output shape: {output.shape}, Sum: {np.sum(output):.3f}")

    # Copy to Android Assets
    os.makedirs(ASSETS_DIR, exist_ok=True)
    android_dest = os.path.join(ASSETS_DIR, "lifeguard_audio_classifier.tflite")
    shutil.copy2(tflite_path, android_dest)
    print(f"[OK] Deployed model to Android assets: {android_dest}")

    # Copy labels.txt
    labels_src = os.path.join(MODEL_DIR, "labels.txt")
    if os.path.exists(labels_src):
        shutil.copy2(labels_src, os.path.join(ASSETS_DIR, "labels.txt"))
        print(f"[OK] Deployed labels to Android assets: {os.path.join(ASSETS_DIR, 'labels.txt')}")

    # Copy config.json to assets for runtime parameter verification
    shutil.copy2(CONFIG_PATH, os.path.join(ASSETS_DIR, "ml_config.json"))
    print(f"[OK] Deployed ml_config.json to Android assets")

    return tflite_path

if __name__ == "__main__":
    convert_model()
