package com.lifeguard.ai.auth;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import androidx.appcompat.app.AppCompatActivity;
import com.lifeguard.ai.R;

public class GetStartedActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_get_started);

        Button btnGetStarted = findViewById(R.id.btnGetStarted);
        Button btnSignIn = findViewById(R.id.btnSignIn);

        btnGetStarted.setOnClickListener(v -> {
            startActivity(new Intent(GetStartedActivity.this, RegisterActivity.class));
        });

        btnSignIn.setOnClickListener(v -> {
            startActivity(new Intent(GetStartedActivity.this, LoginActivity.class));
        });
    }
}
