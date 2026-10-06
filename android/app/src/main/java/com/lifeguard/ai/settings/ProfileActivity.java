package com.lifeguard.ai.settings;

import android.os.Bundle;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.lifeguard.ai.R;
import com.lifeguard.ai.utils.SessionManager;

public class ProfileActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_profile);

        ImageView btnBack = findViewById(R.id.btnBack);
        TextView tvProfileName = findViewById(R.id.tvProfileName);
        TextView tvProfileMobile = findViewById(R.id.tvProfileMobile);

        btnBack.setOnClickListener(v -> finish());

        SessionManager session = SessionManager.getInstance(this);
        tvProfileName.setText(session.getUserName());
        tvProfileMobile.setText(session.getUserMobile());
    }
}
