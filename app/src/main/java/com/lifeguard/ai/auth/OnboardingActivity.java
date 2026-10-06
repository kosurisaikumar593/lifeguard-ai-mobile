package com.lifeguard.ai.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.lifeguard.ai.R;

public class OnboardingActivity extends AppCompatActivity {

    private int currentStep = 0;
    private ImageView ivOnboardingStep;
    private TextView tvOnboardingTitle;
    private TextView tvOnboardingDesc;
    private View dot1, dot2, dot3;
    private Button btnContinue, btnSkip;

    private final String[] titles = {
        "Intelligent Audio Safety",
        "Connected Safety Contacts",
        "Fast Emergency Response"
    };

    private final String[] descriptions = {
        "LifeGuard AI monitors surrounding sound levels locally. When sound reaches 90 dB, Gemini AI analyzes whether vocal distress is present.",
        "Add trusted contacts through LifeGuard AI. When an alert triggers, your contacts receive high-priority alerts with live location.",
        "LifeGuard AI gives you 10 seconds to confirm if you are safe before initiating automatic emergency protocols and notifying help."
    };

    private final int[] iconRes = {
        R.drawable.ic_shield,
        R.drawable.ic_contacts,
        R.drawable.ic_sos
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_onboarding);

        ivOnboardingStep = findViewById(R.id.ivOnboardingStep);
        tvOnboardingTitle = findViewById(R.id.tvOnboardingTitle);
        tvOnboardingDesc = findViewById(R.id.tvOnboardingDesc);
        dot1 = findViewById(R.id.dot1);
        dot2 = findViewById(R.id.dot2);
        dot3 = findViewById(R.id.dot3);
        btnContinue = findViewById(R.id.btnContinue);
        btnSkip = findViewById(R.id.btnSkip);

        updateStep();

        btnContinue.setOnClickListener(v -> {
            if (currentStep < 2) {
                currentStep++;
                updateStep();
            } else {
                goToGetStarted();
            }
        });

        btnSkip.setOnClickListener(v -> goToGetStarted());
    }

    private void updateStep() {
        tvOnboardingTitle.setText(titles[currentStep]);
        tvOnboardingDesc.setText(descriptions[currentStep]);
        ivOnboardingStep.setImageResource(iconRes[currentStep]);

        dot1.setBackgroundTintList(getColorStateList(currentStep == 0 ? R.color.primary_blue : R.color.divider_border));
        dot2.setBackgroundTintList(getColorStateList(currentStep == 1 ? R.color.primary_blue : R.color.divider_border));
        dot3.setBackgroundTintList(getColorStateList(currentStep == 2 ? R.color.primary_blue : R.color.divider_border));

        if (currentStep == 2) {
            btnContinue.setText("Get Started");
        } else {
            btnContinue.setText("Continue");
        }
    }

    private void goToGetStarted() {
        startActivity(new Intent(OnboardingActivity.this, GetStartedActivity.class));
        finish();
    }
}
