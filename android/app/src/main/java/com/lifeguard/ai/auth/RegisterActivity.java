package com.lifeguard.ai.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.lifeguard.ai.R;
import com.lifeguard.ai.api.ApiClient;
import com.lifeguard.ai.models.ApiResponse;
import java.util.HashMap;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RegisterActivity extends AppCompatActivity {

    private EditText etName, etMobile, etPassword, etConfirmPassword;
    private Button btnRegister;
    private ProgressBar progressBar;
    private TextView tvLoginLink;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        etName = findViewById(R.id.etName);
        etMobile = findViewById(R.id.etMobile);
        etPassword = findViewById(R.id.etPassword);
        etConfirmPassword = findViewById(R.id.etConfirmPassword);
        btnRegister = findViewById(R.id.btnRegister);
        progressBar = findViewById(R.id.progressBar);
        tvLoginLink = findViewById(R.id.tvLoginLink);

        tvLoginLink.setOnClickListener(v -> {
            startActivity(new Intent(RegisterActivity.this, LoginActivity.class));
            finish();
        });

        btnRegister.setOnClickListener(v -> performRegistration());
    }

    private void performRegistration() {
        String name = etName.getText().toString().trim();
        String mobile = etMobile.getText().toString().trim();
        String password = etPassword.getText().toString().trim();
        String confirmPassword = etConfirmPassword.getText().toString().trim();

        if (name.isEmpty()) {
            etName.setError("Full Name is required");
            etName.requestFocus();
            return;
        }

        if (mobile.isEmpty()) {
            etMobile.setError("Mobile number is required");
            etMobile.requestFocus();
            return;
        }

        if (password.length() < 6) {
            etPassword.setError("Password must be at least 6 characters");
            etPassword.requestFocus();
            return;
        }

        if (!password.equals(confirmPassword)) {
            etConfirmPassword.setError("Passwords do not match");
            etConfirmPassword.requestFocus();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnRegister.setEnabled(false);

        Map<String, String> body = new HashMap<>();
        body.put("name", name);
        body.put("mobile", mobile);
        body.put("password", password);

        ApiClient.getService(this).register(body).enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                progressBar.setVisibility(View.GONE);
                btnRegister.setEnabled(true);

                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                    String otpCode = response.body().getOtpCode();
                    Toast.makeText(RegisterActivity.this, "Verification code sent!", Toast.LENGTH_SHORT).show();

                    Intent intent = new Intent(RegisterActivity.this, OtpVerificationActivity.class);
                    intent.putExtra("mobile", mobile);
                    intent.putExtra("otp_demo", otpCode); // For convenient testing verification
                    intent.putExtra("purpose", "registration");
                    startActivity(intent);
                    finish();
                } else {
                    String msg = "Registration failed.";
                    if (response.body() != null && response.body().getMessage() != null) {
                        msg = response.body().getMessage();
                    }
                    Toast.makeText(RegisterActivity.this, msg, Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                btnRegister.setEnabled(true);
                Toast.makeText(RegisterActivity.this, "Network error: Unable to connect to server.", Toast.LENGTH_LONG).show();
            }
        });
    }
}
