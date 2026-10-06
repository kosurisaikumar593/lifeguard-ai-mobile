package com.lifeguard.ai.history;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.lifeguard.ai.R;
import com.lifeguard.ai.api.ApiClient;
import com.lifeguard.ai.models.ApiResponse;
import com.lifeguard.ai.models.EmergencyEvent;
import java.util.ArrayList;
import java.util.List;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class HistoryFragment extends Fragment {

    private RecyclerView rvHistory;
    private TextView tvEmptyHistory;
    private SwipeRefreshLayout swipeRefreshHistory;
    private HistoryAdapter adapter;
    private final List<EmergencyEvent> historyList = new ArrayList<>();

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_history, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        rvHistory = view.findViewById(R.id.rvHistory);
        tvEmptyHistory = view.findViewById(R.id.tvEmptyHistory);
        swipeRefreshHistory = view.findViewById(R.id.swipeRefreshHistory);

        rvHistory.setLayoutManager(new LinearLayoutManager(requireContext()));
        adapter = new HistoryAdapter(historyList, event -> {
            Intent intent = new Intent(requireContext(), IncidentDetailActivity.class);
            intent.putExtra("event", event);
            startActivity(intent);
        });
        rvHistory.setAdapter(adapter);

        swipeRefreshHistory.setOnRefreshListener(this::loadHistory);
        loadHistory();
    }

    private void loadHistory() {
        swipeRefreshHistory.setRefreshing(true);
        ApiClient.getService(requireContext()).getEmergencyHistory().enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                swipeRefreshHistory.setRefreshing(false);
                if (response.isSuccessful() && response.body() != null) {
                    historyList.clear();
                    if (response.body().getHistory() != null) {
                        historyList.addAll(response.body().getHistory());
                    }
                    adapter.notifyDataSetChanged();
                    tvEmptyHistory.setVisibility(historyList.isEmpty() ? View.VISIBLE : View.GONE);
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                swipeRefreshHistory.setRefreshing(false);
                Toast.makeText(requireContext(), "Failed to load incident history.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        loadHistory();
    }

    private interface OnIncidentClickListener {
        void onIncidentClick(EmergencyEvent event);
    }

    private static class HistoryAdapter extends RecyclerView.Adapter<HistoryAdapter.Holder> {
        private final List<EmergencyEvent> list;
        private final OnIncidentClickListener listener;

        public HistoryAdapter(List<EmergencyEvent> list, OnIncidentClickListener listener) {
            this.list = list;
            this.listener = listener;
        }

        @NonNull
        @Override
        public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View v = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_incident, parent, false);
            return new Holder(v);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder holder, int position) {
            EmergencyEvent ev = list.get(position);
            holder.tvIncidentDate.setText(ev.getCreatedAt() != null ? ev.getCreatedAt() : "Recorded Incident");
            holder.tvIncidentStatusBadge.setText(ev.getEmergencyStatus() != null ? ev.getEmergencyStatus().toUpperCase() : "RESOLVED");

            if ("cancelled".equalsIgnoreCase(ev.getEmergencyStatus()) || "safe".equalsIgnoreCase(ev.getUserResponse())) {
                holder.tvIncidentStatusBadge.setBackgroundTintList(holder.itemView.getContext().getColorStateList(R.color.active_green_light));
                holder.tvIncidentStatusBadge.setTextColor(holder.itemView.getContext().getColor(R.color.active_green_dark));
            } else {
                holder.tvIncidentStatusBadge.setBackgroundTintList(holder.itemView.getContext().getColorStateList(R.color.sos_red_light));
                holder.tvIncidentStatusBadge.setTextColor(holder.itemView.getContext().getColor(R.color.sos_red));
            }

            if (ev.getSoundLevel() != null) {
                holder.tvIncidentSoundDb.setText(ev.getSoundLevel() + " dB");
            } else {
                holder.tvIncidentSoundDb.setText("SOS");
            }

            String aiText = "• " + (ev.getAiReason() != null ? ev.getAiReason() : (ev.getSoundSubtype() != null ? ev.getSoundSubtype() : "Manual SOS"));
            holder.tvIncidentAiDetection.setText(aiText);

            String locText = (ev.getLatitude() != null && ev.getLongitude() != null) ? "Available" : "Unavailable";
            holder.tvIncidentResponse.setText("Response: " + (ev.getUserResponse() != null ? ev.getUserResponse() : "none") + " • Location: " + locText);

            holder.itemView.setOnClickListener(v -> {
                if (listener != null) listener.onIncidentClick(ev);
            });
        }

        @Override
        public int getItemCount() { return list.size(); }

        static class Holder extends RecyclerView.ViewHolder {
            TextView tvIncidentDate, tvIncidentStatusBadge, tvIncidentSoundDb, tvIncidentAiDetection, tvIncidentResponse;
            public Holder(@NonNull View itemView) {
                super(itemView);
                tvIncidentDate = itemView.findViewById(R.id.tvIncidentDate);
                tvIncidentStatusBadge = itemView.findViewById(R.id.tvIncidentStatusBadge);
                tvIncidentSoundDb = itemView.findViewById(R.id.tvIncidentSoundDb);
                tvIncidentAiDetection = itemView.findViewById(R.id.tvIncidentAiDetection);
                tvIncidentResponse = itemView.findViewById(R.id.tvIncidentResponse);
            }
        }
    }
}
