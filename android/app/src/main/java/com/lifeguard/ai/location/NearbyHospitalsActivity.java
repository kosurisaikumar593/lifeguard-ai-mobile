package com.lifeguard.ai.location;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.lifeguard.ai.R;
import java.util.ArrayList;
import java.util.List;

public class NearbyHospitalsActivity extends AppCompatActivity {

    public static class Hospital {
        String name;
        String distance;
        String address;
        String phone;
        double lat;
        double lng;

        public Hospital(String name, String distance, String address, String phone, double lat, double lng) {
            this.name = name;
            this.distance = distance;
            this.address = address;
            this.phone = phone;
            this.lat = lat;
            this.lng = lng;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_nearby_hospitals);

        ImageView btnBack = findViewById(R.id.btnBack);
        RecyclerView rvHospitals = findViewById(R.id.rvHospitals);

        btnBack.setOnClickListener(v -> finish());

        rvHospitals.setLayoutManager(new LinearLayoutManager(this));

        List<Hospital> list = new ArrayList<>();
        list.add(new Hospital("Apollo Emergency & Trauma Center", "0.8 km", "Road No. 72, Medical Square", "1066", 17.4156, 78.4750));
        list.add(new Hospital("Care Hospital Emergency Care", "1.4 km", "Banjara Hills Main Road", "040-61656565", 17.4190, 78.4480));
        list.add(new Hospital("Yashoda Hospital Emergency Wing", "2.1 km", "Raj Bhavan Road, Somajiguda", "040-45674567", 17.4245, 78.4590));
        list.add(new Hospital("Government General Hospital & Trauma Care", "3.2 km", "Station Road, Health Sector", "108", 17.4000, 78.4700));

        rvHospitals.setAdapter(new HospitalAdapter(list));
    }

    private class HospitalAdapter extends RecyclerView.Adapter<HospitalAdapter.Holder> {
        private final List<Hospital> items;

        public HospitalAdapter(List<Hospital> items) {
            this.items = items;
        }

        @NonNull
        @Override
        public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View v = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_hospital, parent, false);
            return new Holder(v);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder holder, int position) {
            Hospital h = items.get(position);
            holder.tvHospitalName.setText(h.name);
            holder.tvHospitalDistance.setText(h.distance + " away • 24/7 Emergency");
            holder.tvHospitalAddress.setText(h.address);

            holder.btnCallHospital.setOnClickListener(v -> {
                Intent intent = new Intent(Intent.ACTION_DIAL);
                intent.setData(Uri.parse("tel:" + h.phone));
                startActivity(intent);
            });

            holder.btnOpenMapsHospital.setOnClickListener(v -> {
                Uri mapUri = Uri.parse("geo:" + h.lat + "," + h.lng + "?q=" + Uri.encode(h.name));
                Intent mapIntent = new Intent(Intent.ACTION_VIEW, mapUri);
                startActivity(mapIntent);
            });
        }

        @Override
        public int getItemCount() {
            return items.size();
        }

        class Holder extends RecyclerView.ViewHolder {
            TextView tvHospitalName, tvHospitalDistance, tvHospitalAddress;
            Button btnCallHospital, btnOpenMapsHospital;

            public Holder(@NonNull View itemView) {
                super(itemView);
                tvHospitalName = itemView.findViewById(R.id.tvHospitalName);
                tvHospitalDistance = itemView.findViewById(R.id.tvHospitalDistance);
                tvHospitalAddress = itemView.findViewById(R.id.tvHospitalAddress);
                btnCallHospital = itemView.findViewById(R.id.btnCallHospital);
                btnOpenMapsHospital = itemView.findViewById(R.id.btnOpenMapsHospital);
            }
        }
    }
}
