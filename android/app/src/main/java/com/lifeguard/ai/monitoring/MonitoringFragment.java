package com.lifeguard.ai.monitoring;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import com.lifeguard.ai.R;
import com.lifeguard.ai.services.SoundMonitoringForegroundService;
import com.lifeguard.ai.utils.SessionManager;

public class MonitoringFragment extends Fragment {

    private TextView tvLiveDb, tvMonitoringStateDesc, tvThresholdNotice, tvAnalysisStatus;
    private Button btnMonitoringAction;
    private LinearLayout bannerAnalyzing;
    private View bar1, bar2, bar3, bar4, bar5, bar6, bar7;

    private boolean isMonitoring = false;

    private final BroadcastReceiver soundReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent != null && SoundMonitoringForegroundService.ACTION_SOUND_LEVEL_BROADCAST.equals(intent.getAction())) {
                int db = intent.getIntExtra(SoundMonitoringForegroundService.EXTRA_DECIBELS, 45);
                boolean analyzing = intent.getBooleanExtra(SoundMonitoringForegroundService.EXTRA_ANALYZING, false);

                if (tvLiveDb != null) {
                    tvLiveDb.setText(db + " dB");
                    animateBars(db);

                    if (analyzing) {
                        bannerAnalyzing.setVisibility(View.VISIBLE);
                        tvMonitoringStateDesc.setText("Status: Analyzing Audio with Gemini AI...");
                    } else {
                        bannerAnalyzing.setVisibility(View.GONE);
                        tvMonitoringStateDesc.setText("Status: Monitoring Active • Normal");
                    }
                }
            }
        }
    };

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_monitoring, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        tvLiveDb = view.findViewById(R.id.tvLiveDb);
        tvMonitoringStateDesc = view.findViewById(R.id.tvMonitoringStateDesc);
        tvThresholdNotice = view.findViewById(R.id.tvThresholdNotice);
        tvAnalysisStatus = view.findViewById(R.id.tvAnalysisStatus);
        btnMonitoringAction = view.findViewById(R.id.btnMonitoringAction);
        bannerAnalyzing = view.findViewById(R.id.bannerAnalyzing);

        bar1 = view.findViewById(R.id.bar1);
        bar2 = view.findViewById(R.id.bar2);
        bar3 = view.findViewById(R.id.bar3);
        bar4 = view.findViewById(R.id.bar4);
        bar5 = view.findViewById(R.id.bar5);
        bar6 = view.findViewById(R.id.bar6);
        bar7 = view.findViewById(R.id.bar7);

        int threshold = SessionManager.getInstance(requireContext()).getSoundThreshold();
        tvThresholdNotice.setText("Analysis Threshold: " + threshold + " dB");

        updateUI();

        btnMonitoringAction.setOnClickListener(v -> toggleMonitoring());
    }

    private void updateUI() {
        isMonitoring = SoundMonitoringForegroundService.isRunning();
        if (isMonitoring) {
            tvMonitoringStateDesc.setText("Status: Monitoring Active");
            tvMonitoringStateDesc.setBackgroundTintList(requireContext().getColorStateList(R.color.active_green_light));
            tvMonitoringStateDesc.setTextColor(requireContext().getColor(R.color.active_green_dark));
            btnMonitoringAction.setText("STOP MONITORING");
            btnMonitoringAction.setBackgroundTintList(requireContext().getColorStateList(R.color.text_secondary));
        } else {
            tvMonitoringStateDesc.setText("Status: Idle");
            tvMonitoringStateDesc.setBackgroundTintList(requireContext().getColorStateList(R.color.divider_border));
            tvMonitoringStateDesc.setTextColor(requireContext().getColor(R.color.text_secondary));
            btnMonitoringAction.setText("START MONITORING");
            btnMonitoringAction.setBackgroundTintList(requireContext().getColorStateList(R.color.primary_blue));
            tvLiveDb.setText("-- dB");
            bannerAnalyzing.setVisibility(View.GONE);
        }
    }

    private void toggleMonitoring() {
        Intent intent = new Intent(requireContext(), SoundMonitoringForegroundService.class);
        if (isMonitoring) {
            intent.setAction(SoundMonitoringForegroundService.ACTION_STOP);
            requireContext().startService(intent);
            isMonitoring = false;
            Toast.makeText(requireContext(), "Monitoring stopped.", Toast.LENGTH_SHORT).show();
        } else {
            intent.setAction(SoundMonitoringForegroundService.ACTION_START);
            requireContext().startForegroundService(intent);
            isMonitoring = true;
            Toast.makeText(requireContext(), "Live sound monitoring active.", Toast.LENGTH_SHORT).show();
        }
        updateUI();
    }

    private void animateBars(int db) {
        float factor = Math.max(0.3f, Math.min(1.5f, db / 70.0f));
        if (bar1 != null) bar1.setScaleY(factor * 0.8f);
        if (bar2 != null) bar2.setScaleY(factor * 1.2f);
        if (bar3 != null) bar3.setScaleY(factor * 1.5f);
        if (bar4 != null) bar4.setScaleY(factor * 1.0f);
        if (bar5 != null) bar5.setScaleY(factor * 1.4f);
        if (bar6 != null) bar6.setScaleY(factor * 0.9f);
        if (bar7 != null) bar7.setScaleY(factor * 1.3f);
    }

    @Override
    public void onResume() {
        super.onResume();
        updateUI();
        IntentFilter filter = new IntentFilter(SoundMonitoringForegroundService.ACTION_SOUND_LEVEL_BROADCAST);
        requireContext().registerReceiver(soundReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
    }

    @Override
    public void onPause() {
        super.onPause();
        try {
            requireContext().unregisterReceiver(soundReceiver);
        } catch (Exception ignored) {}
    }
}
