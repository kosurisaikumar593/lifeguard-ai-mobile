package com.lifeguard.ai.auth;

import android.content.Intent;
import android.os.Bundle;
import android.text.InputType;
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
import com.lifeguard.ai.utils.SessionManager;
import java.util.HashMap;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {

    private EditText etMobile, etPassword;
    private TextView tvTogglePassword, tvForgotPassword, tvRegisterLink;
    private Button btnLogin;
    private ProgressBar progressBar;
    private boolean isPasswordVisible = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        etMobile = findViewById(R.id.etMobile);
        etPassword = findViewById(R.id.etPassword);
        tvTogglePassword = findViewById(R.id.tvTogglePassword);
        tvForgotPassword = findViewById(R.id.tvForgotPassword);
        tvRegisterLink = findViewById(R.id.tvRegisterLink);
        btnLogin = findViewById(R.id.btnLogin);
        progressBar = findViewById(R.id.progressBar);

        tvTogglePassword.setOnClickListener(v -> {
            if (isPasswordVisible) {
                etPassword.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
                tvTogglePassword.setText("SHOW");
            } else {
                etPassword.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
                tvTogglePassword.setText("HIDE");
            }
            isPasswordVisible = !isPasswordVisible;
            etPassword.setSelection(etPassword.length());
        });

        tvForgotPassword.setOnClickListener(v -> {
            startActivity(new Intent(LoginActivity.this, ForgotPasswordActivity.class));
        });

        tvRegisterLink.setOnClickListener(v -> {
            startActivity(new Intent(LoginActivity.this, RegisterActivity.class));
            finish();
        });

        btnLogin.setOnClickListener(v -> performLogin());
    }

    private void performLogin() {
        String mobile = etMobile.getText().toString().trim();
        String password = etPassword.getText().toString().trim();

        if (mobile.isEmpty()) {
            etMobile.setError("Mobile number is required");
            etMobile.requestFocus();
            return;
        }

        if (password.isEmpty()) {
            etPassword.setError("Password is required");
            etPassword.requestFocus();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnLogin.setEnabled(false);

        Map<String, String> body = new HashMap<>();
        body.put("mobile", mobile);
        body.put("password", password);

        ApiClient.getService(this).login(body).enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                progressBar.setVisibility(View.GONE);
                btnLogin.setEnabled(true);

                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                    ApiResponse<Void> apiRes = response.body();
                    SessionManager.getInstance(LoginActivity.this).saveUserSession(
                        apiRes.getToken(),
                        apiRes.getUser()
                    );

                    Toast.makeText(LoginActivity.this, "Welcome to LifeGuard AI!", Toast.LENGTH_SHORT).show();
                    startActivity(new Intent(LoginActivity.this, PermissionSetupActivity.class));
                    finish();
                } else {
                    String msg = "Login failed. Check your mobile number and password.";
                    if (response.body() != null && response.body().getMessage() != null) {
                        msg = response.body().getMessage();
                    }
                    Toast.makeText(LoginActivity.this, msg, Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                btnLogin.setEnabled(true);
                Toast.makeText(LoginActivity.this, "Network error: Unable to connect to LifeGuard AI server.", Toast.LENGTH_LONG).show();
            }
        });
    }
}
