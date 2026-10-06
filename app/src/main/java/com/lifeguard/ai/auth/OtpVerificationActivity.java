package com.lifeguard.ai.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.lifeguard.ai.R;
import com.lifeguard.ai.api.ApiClient;
import com.lifeguard.ai.models.ApiResponse;
import com.lifeguard.ai.utils.SessionManager;
import java.util.HashMap;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class OtpVerificationActivity extends AppCompatActivity {

    private String mobile = "";
    private String purpose = "registration";
    private EditText etOtpCode;
    private Button btnVerifyOtp;
    private TextView tvOtpSubtitle, tvDemoOtpHint, btnResendOtp;
    private ProgressBar progressBar;
    private ImageView btnBack;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_otp_verification);

        mobile = getIntent().getStringExtra("mobile");
        purpose = getIntent().getStringExtra("purpose");
        if (purpose == null) purpose = "registration";
        String demoOtp = getIntent().getStringExtra("otp_demo");

        etOtpCode = findViewById(R.id.etOtpCode);
        btnVerifyOtp = findViewById(R.id.btnVerifyOtp);
        tvOtpSubtitle = findViewById(R.id.tvOtpSubtitle);
        tvDemoOtpHint = findViewById(R.id.tvDemoOtpHint);
        btnResendOtp = findViewById(R.id.btnResendOtp);
        progressBar = findViewById(R.id.progressBar);
        btnBack = findViewById(R.id.btnBack);

        if (mobile != null && !mobile.isEmpty()) {
            tvOtpSubtitle.setText("Enter the 6-digit verification code sent to " + mobile);
        }

        if (demoOtp != null && !demoOtp.isEmpty()) {
            tvDemoOtpHint.setVisibility(View.VISIBLE);
            tvDemoOtpHint.setText("LifeGuard SMS Simulation: Your verification OTP is " + demoOtp);
            etOtpCode.setText(demoOtp);
        }

        btnBack.setOnClickListener(v -> finish());
        btnVerifyOtp.setOnClickListener(v -> verifyOtp());
        btnResendOtp.setOnClickListener(v -> resendOtp());
    }

    private void verifyOtp() {
        String code = etOtpCode.getText().toString().trim();
        if (code.length() != 6) {
            etOtpCode.setError("Please enter complete 6-digit OTP");
            etOtpCode.requestFocus();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnVerifyOtp.setEnabled(false);

        Map<String, String> body = new HashMap<>();
        body.put("mobile", mobile);
        body.put("otpCode", code);
        body.put("purpose", purpose);

        ApiClient.getService(this).verifyOtp(body).enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                progressBar.setVisibility(View.GONE);
                btnVerifyOtp.setEnabled(true);

                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                    ApiResponse<Void> apiRes = response.body();
                    SessionManager.getInstance(OtpVerificationActivity.this).saveUserSession(
                        apiRes.getToken(),
                        apiRes.getUser()
                    );

                    Toast.makeText(OtpVerificationActivity.this, "Account verified successfully!", Toast.LENGTH_SHORT).show();
                    startActivity(new Intent(OtpVerificationActivity.this, PermissionSetupActivity.class));
                    finishAffinity();
                } else {
                    String msg = "Invalid verification code.";
                    if (response.body() != null && response.body().getMessage() != null) {
                        msg = response.body().getMessage();
                    }
                    Toast.makeText(OtpVerificationActivity.this, msg, Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                btnVerifyOtp.setEnabled(true);
                Toast.makeText(OtpVerificationActivity.this, "Network error: Unable to verify OTP.", Toast.LENGTH_LONG).show();
            }
        });
    }

    private void resendOtp() {
        Toast.makeText(this, "Requesting new verification code...", Toast.LENGTH_SHORT).show();
        Map<String, String> body = new HashMap<>();
        body.put("mobile", mobile);
        ApiClient.getService(this).forgotPassword(body).enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                    String newOtp = response.body().getOtpCode();
                    tvDemoOtpHint.setVisibility(View.VISIBLE);
                    tvDemoOtpHint.setText("New verification OTP generated: " + newOtp);
                    etOtpCode.setText(newOtp);
                    Toast.makeText(OtpVerificationActivity.this, "New OTP sent!", Toast.LENGTH_SHORT).show();
                }
            }
            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {}
        });
    }
}
