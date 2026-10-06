package com.lifeguard.ai.contacts;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
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

public class AddContactActivity extends AppCompatActivity {

    private EditText etContactName, etContactMobile;
    private Button btnSendInvitation;
    private ProgressBar progressBar;
    private ImageView btnBack;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_contact);

        etContactName = findViewById(R.id.etContactName);
        etContactMobile = findViewById(R.id.etContactMobile);
        btnSendInvitation = findViewById(R.id.btnSendInvitation);
        progressBar = findViewById(R.id.progressBar);
        btnBack = findViewById(R.id.btnBack);

        btnBack.setOnClickListener(v -> finish());
        btnSendInvitation.setOnClickListener(v -> sendInvitation());
    }

    private void sendInvitation() {
        String name = etContactName.getText().toString().trim();
        String mobile = etContactMobile.getText().toString().trim();

        if (mobile.isEmpty()) {
            etContactMobile.setError("Mobile number is required");
            etContactMobile.requestFocus();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnSendInvitation.setEnabled(false);

        Map<String, String> body = new HashMap<>();
        body.put("contact_name", name);
        body.put("contact_mobile", mobile);

        ApiClient.getService(this).requestContact(body).enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                progressBar.setVisibility(View.GONE);
                btnSendInvitation.setEnabled(true);

                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                    Toast.makeText(AddContactActivity.this, "Invitation sent! When accepted, you will be connected.", Toast.LENGTH_LONG).show();
                    finish();
                } else {
                    String msg = "Failed to send contact invitation.";
                    if (response.body() != null && response.body().getMessage() != null) {
                        msg = response.body().getMessage();
                    }
                    Toast.makeText(AddContactActivity.this, msg, Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                btnSendInvitation.setEnabled(true);
                Toast.makeText(AddContactActivity.this, "Network error: Unable to contact server.", Toast.LENGTH_LONG).show();
            }
        });
    }
}
