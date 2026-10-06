package com.lifeguard.ai.auth;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.lifeguard.ai.R;
import com.lifeguard.ai.home.MainActivity;
import java.util.ArrayList;
import java.util.List;

public class PermissionSetupActivity extends AppCompatActivity {

    private static final int PERMISSION_REQ_CODE = 100;
    private Button btnGrantPermissions, btnOpenSettings;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_permission_setup);

        btnGrantPermissions = findViewById(R.id.btnGrantPermissions);
        btnOpenSettings = findViewById(R.id.btnOpenSettings);

        btnGrantPermissions.setOnClickListener(v -> checkAndRequestPermissions());
        btnOpenSettings.setOnClickListener(v -> openAppSettings());

        if (areAllPermissionsGranted()) {
            goToMain();
        }
    }

    private boolean areAllPermissionsGranted() {
        boolean mic = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        boolean fineLoc = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        return mic && fineLoc;
    }

    private void checkAndRequestPermissions() {
        List<String> permissions = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CALL_PHONE);
        }

        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toArray(new String[0]), PERMISSION_REQ_CODE);
        } else {
            goToMain();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CODE) {
            boolean micGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
            boolean locGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;

            if (micGranted && locGranted) {
                Toast.makeText(this, "Permissions configured successfully.", Toast.LENGTH_SHORT).show();
                goToMain();
            } else {
                btnOpenSettings.setVisibility(View.VISIBLE);
                new AlertDialog.Builder(this)
                    .setTitle("Permission Required")
                    .setMessage(R.string.permission_required_dialog)
                    .setPositiveButton("Allow from Settings", (dialog, which) -> openAppSettings())
                    .setNegativeButton("Continue Anyway", (dialog, which) -> goToMain())
                    .show();
            }
        }
    }

    private void openAppSettings() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        Uri uri = Uri.fromParts("package", getPackageName(), null);
        intent.setData(uri);
        startActivity(intent);
    }

    private void goToMain() {
        startActivity(new Intent(PermissionSetupActivity.this, MainActivity.class));
        finish();
    }
}
