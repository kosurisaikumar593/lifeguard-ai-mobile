package com.lifeguard.ai.auth;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
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

public class ForgotPasswordActivity extends AppCompatActivity {

    private EditText etMobile, etOtpCode, etNewPassword;
    private Button btnSendResetOtp, btnResetPassword;
    private LinearLayout layoutResetFields;
    private ProgressBar progressBar;
    private ImageView btnBack;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_forgot_password);

        etMobile = findViewById(R.id.etMobile);
        etOtpCode = findViewById(R.id.etOtpCode);
        etNewPassword = findViewById(R.id.etNewPassword);
        btnSendResetOtp = findViewById(R.id.btnSendResetOtp);
        btnResetPassword = findViewById(R.id.btnResetPassword);
        layoutResetFields = findViewById(R.id.layoutResetFields);
        progressBar = findViewById(R.id.progressBar);
        btnBack = findViewById(R.id.btnBack);

        btnBack.setOnClickListener(v -> finish());

        btnSendResetOtp.setOnClickListener(v -> {
            String mobile = etMobile.getText().toString().trim();
            if (mobile.isEmpty()) {
                etMobile.setError("Mobile number required");
                return;
            }

            progressBar.setVisibility(View.VISIBLE);
            Map<String, String> body = new HashMap<>();
            body.put("mobile", mobile);

            ApiClient.getService(this).forgotPassword(body).enqueue(new Callback<ApiResponse<Void>>() {
                @Override
                public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                    progressBar.setVisibility(View.GONE);
                    if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                        String otp = response.body().getOtpCode();
                        Toast.makeText(ForgotPasswordActivity.this, "Reset OTP generated: " + otp, Toast.LENGTH_LONG).show();
                        if (otp != null) etOtpCode.setText(otp);
                        layoutResetFields.setVisibility(View.VISIBLE);
                        btnSendResetOtp.setVisibility(View.GONE);
                        etMobile.setEnabled(false);
                    } else {
                        Toast.makeText(ForgotPasswordActivity.this, "Mobile number not found.", Toast.LENGTH_SHORT).show();
                    }
                }
                @Override
                public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                    progressBar.setVisibility(View.GONE);
                    Toast.makeText(ForgotPasswordActivity.this, "Network error.", Toast.LENGTH_SHORT).show();
                }
            });
        });

        btnResetPassword.setOnClickListener(v -> {
            String mobile = etMobile.getText().toString().trim();
            String code = etOtpCode.getText().toString().trim();
            String newPass = etNewPassword.getText().toString().trim();

            if (code.length() != 6 || newPass.length() < 6) {
                Toast.makeText(this, "Enter valid 6-digit OTP and password (min 6 chars)", Toast.LENGTH_SHORT).show();
                return;
            }

            progressBar.setVisibility(View.VISIBLE);
            Map<String, String> body = new HashMap<>();
            body.put("mobile", mobile);
            body.put("otpCode", code);
            body.put("newPassword", newPass);

            ApiClient.getService(this).resetPassword(body).enqueue(new Callback<ApiResponse<Void>>() {
                @Override
                public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                    progressBar.setVisibility(View.GONE);
                    if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                        Toast.makeText(ForgotPasswordActivity.this, "Password updated successfully! Please log in.", Toast.LENGTH_LONG).show();
                        finish();
                    } else {
                        Toast.makeText(ForgotPasswordActivity.this, "Reset failed. Check OTP.", Toast.LENGTH_SHORT).show();
                    }
                }
                @Override
                public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                    progressBar.setVisibility(View.GONE);
                    Toast.makeText(ForgotPasswordActivity.this, "Network error.", Toast.LENGTH_SHORT).show();
                }
            });
        });
    }
}
