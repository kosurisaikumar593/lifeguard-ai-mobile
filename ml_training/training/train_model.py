import os
import sys
import json
import numpy as np

# Add parent directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ml_training.training.dataset_loader import DatasetLoader

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "config.json")
MODEL_SAVE_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def build_lightweight_audio_cnn(input_shape=(92, 64, 1), num_classes=3):
    """Constructs an optimized Mobile Audio CNN preserving temporal and harmonic features."""
    import tensorflow as tf
    from tensorflow.keras import layers, models, regularizers

    model = models.Sequential([
        layers.Input(shape=input_shape, name="audio_spectrogram_input"),
        
        # Block 1 - Low level acoustic edges & formants
        layers.Conv2D(16, kernel_size=(3, 3), padding="same", activation="relu",
                      kernel_regularizer=regularizers.l2(1e-4)),
        layers.BatchNormalization(),
        layers.MaxPooling2D(pool_size=(2, 2)),
        layers.Dropout(0.2),

        # Block 2 - Pitch harmonics & harmonic modulation
        layers.Conv2D(32, kernel_size=(3, 3), padding="same", activation="relu",
                      kernel_regularizer=regularizers.l2(1e-4)),
        layers.BatchNormalization(),
        layers.MaxPooling2D(pool_size=(2, 2)),
        layers.Dropout(0.2),

        # Block 3 - Spectral energy distribution
        layers.Conv2D(64, kernel_size=(3, 3), padding="same", activation="relu",
                      kernel_regularizer=regularizers.l2(1e-4)),
        layers.BatchNormalization(),
        layers.MaxPooling2D(pool_size=(2, 2)),
        layers.Dropout(0.25),

        # Block 4 - Deep representation
        layers.Conv2D(64, kernel_size=(3, 3), padding="same", activation="relu",
                      kernel_regularizer=regularizers.l2(1e-4)),
        layers.BatchNormalization(),
        layers.GlobalAveragePooling2D(),

        # Classification head
        layers.Dense(32, activation="relu", kernel_regularizer=regularizers.l2(1e-4)),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation="softmax", name="classification_output")
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"]
    )
    return model

def train(epochs=35, batch_size=16):
    config = load_config()
    print("=" * 60)
    print(" LIFEGUARD AI — AUDIO CLASSIFIER MODEL TRAINING")
    print("=" * 60)
    print(f"Sample Rate: {config['sample_rate']} Hz")
    print(f"Target Duration: {config['duration_seconds']} seconds ({config['num_samples']} samples)")
    print(f"Input Shape: {config['input_shape']}")
    print(f"Classes: {config['classes']}")
    print("=" * 60)

    loader = DatasetLoader(config=config)
    X_train, y_train, _ = loader.load_split("train", augment=True)
    X_val, y_val, _ = loader.load_split("val", augment=False)

    if len(X_train) == 0:
        print("[!] NOTICE: Dataset directories do not contain enough samples to train.")
        print("[!] Generating acoustic calibration dataset for baseline compilation...")
        from ml_training.generate_calibration_samples import generate_calibration_dataset
        generate_calibration_dataset()
        X_train, y_train, _ = loader.load_split("train", augment=True)
        X_val, y_val, _ = loader.load_split("val", augment=False)

    print(f"Training on {len(X_train)} samples, validating on {len(X_val)} samples.")

    import tensorflow as tf
    from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

    model = build_lightweight_audio_cnn(
        input_shape=tuple(config["input_shape"]),
        num_classes=config["num_classes"]
    )
    model.summary()

    os.makedirs(MODEL_SAVE_DIR, exist_ok=True)
    best_weights_path = os.path.join(MODEL_SAVE_DIR, "best_audio_classifier.keras")

    callbacks = [
        EarlyStopping(monitor="val_accuracy", patience=15, mode="max", restore_best_weights=True),
        ReduceLROnPlateau(monitor="loss", factor=0.5, patience=5, min_lr=1e-5),
        ModelCheckpoint(best_weights_path, monitor="val_accuracy", mode="max", save_best_only=True)
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val) if len(X_val) > 0 else None,
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1
    )

    # Save trained model
    saved_model_path = os.path.join(MODEL_SAVE_DIR, "lifeguard_audio_classifier.keras")
    model.save(saved_model_path)
    print(f"\n[OK] Saved trained Keras model to: {saved_model_path}")

    # Save training history
    history_path = os.path.join(MODEL_SAVE_DIR, "training_history.json")
    with open(history_path, "w") as f:
        serializable_history = {k: [float(val) for val in v] for k, v in history.history.items()}
        json.dump(serializable_history, f, indent=2)
    print(f"[OK] Saved training history to: {history_path}")

    return model, history

if __name__ == "__main__":
    train()
