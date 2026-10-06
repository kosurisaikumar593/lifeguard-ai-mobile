package com.lifeguard.ai.location;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.location.Location;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.lifeguard.ai.R;

public class LocationActivity extends AppCompatActivity {

    private TextView tvGpsStatusBadge, tvCurrentCoordinates, tvLocationAccuracy, tvLastUpdated;
    private Button btnShareLocation, btnOpenInMaps, btnRefreshLocation;
    private FusedLocationProviderClient fusedLocationClient;

    private double latitude = 0.0;
    private double longitude = 0.0;
    private float accuracy = 0.0f;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_location);

        ImageView btnBack = findViewById(R.id.btnBack);
        tvGpsStatusBadge = findViewById(R.id.tvGpsStatusBadge);
        tvCurrentCoordinates = findViewById(R.id.tvCurrentCoordinates);
        tvLocationAccuracy = findViewById(R.id.tvLocationAccuracy);
        tvLastUpdated = findViewById(R.id.tvLastUpdated);
        btnShareLocation = findViewById(R.id.btnShareLocation);
        btnOpenInMaps = findViewById(R.id.btnOpenInMaps);
        btnRefreshLocation = findViewById(R.id.btnRefreshLocation);

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        btnBack.setOnClickListener(v -> finish());
        btnRefreshLocation.setOnClickListener(v -> fetchLocation());
        btnShareLocation.setOnClickListener(v -> shareLocationText());
        btnOpenInMaps.setOnClickListener(v -> openInMaps());

        fetchLocation();
    }

    @SuppressLint("MissingPermission")
    private void fetchLocation() {
        tvCurrentCoordinates.setText("Acquiring GPS location...");
        try {
            fusedLocationClient.getLastLocation().addOnSuccessListener(this, location -> {
                if (location != null) {
                    latitude = location.getLatitude();
                    longitude = location.getLongitude();
                    accuracy = location.getAccuracy();

                    tvGpsStatusBadge.setText("ACTIVE");
                    tvGpsStatusBadge.setBackgroundTintList(getColorStateList(R.color.active_green_light));
                    tvGpsStatusBadge.setTextColor(getColor(R.color.active_green_dark));

                    tvCurrentCoordinates.setText(String.format("%.6f° N, %.6f° E", latitude, longitude));
                    tvLocationAccuracy.setText(String.format("Accuracy: ± %.1f meters", accuracy));
                    tvLastUpdated.setText("Last Updated: " + new java.text.SimpleDateFormat("hh:mm:ss a", java.util.Locale.getDefault()).format(new java.util.Date()));
                } else {
                    tvGpsStatusBadge.setText("UNAVAILABLE");
                    tvGpsStatusBadge.setBackgroundTintList(getColorStateList(R.color.sos_red_light));
                    tvGpsStatusBadge.setTextColor(getColor(R.color.sos_red));
                    tvCurrentCoordinates.setText(R.string.location_unavailable);
                    tvLocationAccuracy.setText("Please verify device GPS / Location is turned ON.");
                }
            }).addOnFailureListener(e -> {
                tvCurrentCoordinates.setText(R.string.location_unavailable);
            });
        } catch (Exception e) {
            tvCurrentCoordinates.setText(R.string.location_unavailable);
        }
    }

    private void shareLocationText() {
        if (latitude != 0.0 && longitude != 0.0) {
            String link = "https://maps.google.com/?q=" + latitude + "," + longitude;
            String shareText = "🚨 LifeGuard AI Safety Location Alert:\nMy current location is:\n" + link + "\n(Accurate within " + (int)accuracy + "m)";
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("text/plain");
            shareIntent.putExtra(Intent.EXTRA_TEXT, shareText);
            startActivity(Intent.createChooser(shareIntent, "Share Location via"));
        } else {
            Toast.makeText(this, "Location unavailable to share.", Toast.LENGTH_SHORT).show();
        }
    }

    private void openInMaps() {
        if (latitude != 0.0 && longitude != 0.0) {
            Uri mapUri = Uri.parse("https://maps.google.com/?q=" + latitude + "," + longitude);
            startActivity(new Intent(Intent.ACTION_VIEW, mapUri));
        } else {
            Toast.makeText(this, "Location unavailable.", Toast.LENGTH_SHORT).show();
        }
    }
}
