import numpy as np

def compute_confusion_matrix(y_true, y_pred, num_classes=3):
    matrix = np.zeros((num_classes, num_classes), dtype=int)
    for t, p in zip(y_true, y_pred):
        matrix[t, p] += 1
    return matrix

def compute_classification_metrics(y_true, y_pred, class_names=None):
    if class_names is None:
        class_names = ["environmental", "human_normal", "human_distress"]
    num_classes = len(class_names)
    cm = compute_confusion_matrix(y_true, y_pred, num_classes)

    total_samples = len(y_true)
    correct_samples = np.sum(np.diag(cm))
    accuracy = correct_samples / total_samples if total_samples > 0 else 0.0

    per_class = {}
    precisions = []
    recalls = []
    f1s = []

    for c in range(num_classes):
        tp = cm[c, c]
        fp = np.sum(cm[:, c]) - tp
        fn = np.sum(cm[c, :]) - tp

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        precisions.append(precision)
        recalls.append(recall)
        f1s.append(f1)

        per_class[class_names[c]] = {
            "precision": float(precision),
            "recall": float(recall),
            "f1_score": float(f1),
            "support": int(np.sum(cm[c, :]))
        }

    macro_precision = float(np.mean(precisions))
    macro_recall = float(np.mean(recalls))
    macro_f1 = float(np.mean(f1s))

    return {
        "accuracy": float(accuracy),
        "macro_precision": macro_precision,
        "macro_recall": macro_recall,
        "macro_f1": macro_f1,
        "confusion_matrix": cm.tolist(),
        "per_class": per_class,
        "total_test_samples": int(total_samples)
    }

def format_metrics_report(metrics_dict, class_names=None):
    if class_names is None:
        class_names = ["environmental", "human_normal", "human_distress"]
    
    report = []
    report.append("=" * 65)
    report.append(" LIFEGUARD AI — AUDIO CLASSIFIER EVALUATION REPORT")
    report.append("=" * 65)
    report.append(f"Total Evaluated Samples: {metrics_dict['total_test_samples']}")
    report.append(f"Overall Accuracy:        {metrics_dict['accuracy'] * 100:.2f}%")
    report.append(f"Macro Precision:         {metrics_dict['macro_precision'] * 100:.2f}%")
    report.append(f"Macro Recall:            {metrics_dict['macro_recall'] * 100:.2f}%")
    report.append(f"Macro F1-Score:          {metrics_dict['macro_f1'] * 100:.2f}%")
    report.append("-" * 65)
    report.append(f"{'Class':<20} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'Support':<8}")
    report.append("-" * 65)

    for name in class_names:
        stats = metrics_dict["per_class"][name]
        report.append(f"{name:<20} | {stats['precision']*100:>8.2f}% | {stats['recall']*100:>8.2f}% | {stats['f1_score']*100:>8.2f}% | {stats['support']:>8}")

    report.append("-" * 65)
    report.append("CONFUSION MATRIX (Rows: Actual, Columns: Predicted):")
    report.append(" " * 22 + " ".join([f"{n[:8]:>10}" for n in class_names]))
    for idx, row in enumerate(metrics_dict["confusion_matrix"]):
        row_str = " ".join([f"{val:>10}" for val in row])
        report.append(f"{class_names[idx]:<20} | {row_str}")
    report.append("=" * 65)

    return "\n".join(report)
