package com.lifeguard.ai.contacts;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import com.lifeguard.ai.R;
import com.lifeguard.ai.api.ApiClient;
import com.lifeguard.ai.models.ApiResponse;
import com.lifeguard.ai.models.Contact;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ContactDetailActivity extends AppCompatActivity {

    private Contact contact;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_contact_detail);

        contact = (Contact) getIntent().getSerializableExtra("contact");

        ImageView btnBack = findViewById(R.id.btnBack);
        TextView tvContactAvatar = findViewById(R.id.tvContactAvatar);
        TextView tvContactName = findViewById(R.id.tvContactName);
        TextView tvContactMobile = findViewById(R.id.tvContactMobile);
        TextView tvContactStatus = findViewById(R.id.tvContactStatus);
        Button btnCallContact = findViewById(R.id.btnCallContact);
        Button btnRemoveContact = findViewById(R.id.btnRemoveContact);

        btnBack.setOnClickListener(v -> finish());

        if (contact != null) {
            tvContactName.setText(contact.getContactName());
            tvContactMobile.setText(contact.getContactMobile());
            tvContactStatus.setText(contact.getStatus().toUpperCase());

            String initials = "C";
            if (contact.getContactName() != null && !contact.getContactName().isEmpty()) {
                String[] parts = contact.getContactName().split(" ");
                if (parts.length > 1) {
                    initials = ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
                } else {
                    initials = ("" + contact.getContactName().charAt(0)).toUpperCase();
                }
            }
            tvContactAvatar.setText(initials);

            btnCallContact.setOnClickListener(v -> {
                Intent callIntent = new Intent(Intent.ACTION_DIAL);
                callIntent.setData(Uri.parse("tel:" + contact.getContactMobile()));
                startActivity(callIntent);
            });

            btnRemoveContact.setOnClickListener(v -> {
                new AlertDialog.Builder(this)
                    .setTitle("Remove Contact")
                    .setMessage("Are you sure you want to remove " + contact.getContactName() + " from your LifeGuard emergency contacts?")
                    .setPositiveButton("Remove", (dialog, which) -> removeContact())
                    .setNegativeButton("Cancel", null)
                    .show();
            });
        }
    }

    private void removeContact() {
        if (contact == null) return;
        ApiClient.getService(this).removeContact(contact.getId()).enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                Toast.makeText(ContactDetailActivity.this, "Contact removed.", Toast.LENGTH_SHORT).show();
                finish();
            }
            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                Toast.makeText(ContactDetailActivity.this, "Error removing contact.", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
