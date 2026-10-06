package com.lifeguard.ai.home;

import android.annotation.SuppressLint;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import com.lifeguard.ai.R;
import com.lifeguard.ai.emergency.EmergencyActivatedActivity;
import com.lifeguard.ai.emergency.ManualSosActivity;
import com.lifeguard.ai.location.LocationActivity;
import com.lifeguard.ai.services.SoundMonitoringForegroundService;
import com.lifeguard.ai.utils.SessionManager;

public class HomeFragment extends Fragment {

    private TextView tvUserGreeting, tvUserAvatar, tvModeBanner;
    private TextView tvMonitoringBadge, tvCurrentDb;
    private Button btnToggleMonitoring, btnLargeSos, btnCall112, btnCall108;
    private View btnCardLocation, btnCardContacts;
    private ProgressBar sosHoldProgressBar;
    private TextView tvSosHoldInstructions;
    private View homeContainer, cardMonitoring;

    private boolean isMonitoringActive = false;
    private Handler holdHandler = new Handler(Looper.getMainLooper());
    private int holdProgress = 0;
    private static final int HOLD_DURATION_MS = 3000;

    private final BroadcastReceiver soundUpdateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent != null && SoundMonitoringForegroundService.ACTION_SOUND_LEVEL_BROADCAST.equals(intent.getAction())) {
                int db = intent.getIntExtra(SoundMonitoringForegroundService.EXTRA_DECIBELS, 45);
                boolean analyzing = intent.getBooleanExtra(SoundMonitoringForegroundService.EXTRA_ANALYZING, false);
                if (tvCurrentDb != null) {
                    tvCurrentDb.setText(db + " dB");
                    if (analyzing) {
                        tvMonitoringBadge.setText("Analyzing Audio...");
                        tvMonitoringBadge.setBackgroundTintList(requireContext().getColorStateList(R.color.ai_purple_light));
                        tvMonitoringBadge.setTextColor(requireContext().getColor(R.color.ai_purple_dark));
                    } else {
                        tvMonitoringBadge.setText("MONITORING ACTIVE");
                        tvMonitoringBadge.setBackgroundTintList(requireContext().getColorStateList(R.color.active_green_light));
                        tvMonitoringBadge.setTextColor(requireContext().getColor(R.color.active_green_dark));
                    }
                }
            }
        }
    };

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_home, container, false);
    }

    @SuppressLint("ClickableViewAccessibility")
    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        tvUserGreeting = view.findViewById(R.id.tvUserGreeting);
        tvUserAvatar = view.findViewById(R.id.tvUserAvatar);
        tvModeBanner = view.findViewById(R.id.tvModeBanner);
        tvMonitoringBadge = view.findViewById(R.id.tvMonitoringBadge);
        tvCurrentDb = view.findViewById(R.id.tvCurrentDb);
        btnToggleMonitoring = view.findViewById(R.id.btnToggleMonitoring);
        btnLargeSos = view.findViewById(R.id.btnLargeSos);
        sosHoldProgressBar = view.findViewById(R.id.sosHoldProgressBar);
        tvSosHoldInstructions = view.findViewById(R.id.tvSosHoldInstructions);
        btnCardLocation = view.findViewById(R.id.btnCardLocation);
        btnCardContacts = view.findViewById(R.id.btnCardContacts);
        btnCall112 = view.findViewById(R.id.btnCall112);
        btnCall108 = view.findViewById(R.id.btnCall108);
        homeContainer = view.findViewById(R.id.homeContainer);
        cardMonitoring = view.findViewById(R.id.cardMonitoring);

        setupUserInfoAndTheme();
        updateMonitoringStateUI();

        btnToggleMonitoring.setOnClickListener(v -> toggleSoundMonitoring());

        // Press-and-hold 3 seconds protection for SOS
        btnLargeSos.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    startSosHoldTimer();
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    cancelSosHoldTimer();
                    return true;
            }
            return false;
        });

        btnCardLocation.setOnClickListener(v -> startActivity(new Intent(requireContext(), LocationActivity.class)));
        btnCardContacts.setOnClickListener(v -> {
            if (getActivity() instanceof MainActivity) {
                ((MainActivity) getActivity()).navigateToTab(R.id.navigation_contacts);
            }
        });

        btnCall112.setOnClickListener(v -> dialNumber("112"));
        btnCall108.setOnClickListener(v -> dialNumber("108"));
    }

    private void setupUserInfoAndTheme() {
        SessionManager session = SessionManager.getInstance(requireContext());
        String name = session.getUserName();
        tvUserGreeting.setText("Hello, " + name + " 👋");

        String initials = "SK";
        if (name != null && !name.isEmpty()) {
            String[] parts = name.split(" ");
            if (parts.length > 1) {
                initials = ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
            } else {
                initials = ("" + name.charAt(0)).toUpperCase();
            }
        }
        tvUserAvatar.setText(initials);

        // Check Night Safety Mode (6 PM - 6 AM or Manual Override)
        boolean isNight = session.isNightThemeActive();
        if (isNight) {
            tvModeBanner.setText("🌙 Night Safety Mode Active");
            tvModeBanner.setBackgroundTintList(requireContext().getColorStateList(R.color.night_card_border));
        } else {
            tvModeBanner.setText("☀️ Day Mode Active");
        }
    }

    private void updateMonitoringStateUI() {
        isMonitoringActive = SoundMonitoringForegroundService.isRunning();
        if (isMonitoringActive) {
            tvMonitoringBadge.setText("MONITORING ACTIVE");
            tvMonitoringBadge.setBackgroundTintList(requireContext().getColorStateList(R.color.active_green_light));
            tvMonitoringBadge.setTextColor(requireContext().getColor(R.color.active_green_dark));
            btnToggleMonitoring.setText("STOP");
            btnToggleMonitoring.setBackgroundTintList(requireContext().getColorStateList(R.color.text_secondary));
        } else {
            tvMonitoringBadge.setText("Monitoring OFF");
            tvMonitoringBadge.setBackgroundTintList(requireContext().getColorStateList(R.color.divider_border));
            tvMonitoringBadge.setTextColor(requireContext().getColor(R.color.text_secondary));
            btnToggleMonitoring.setText("START");
            btnToggleMonitoring.setBackgroundTintList(requireContext().getColorStateList(R.color.primary_blue));
            tvCurrentDb.setText("-- dB");
        }
    }

    private void toggleSoundMonitoring() {
        Intent intent = new Intent(requireContext(), SoundMonitoringForegroundService.class);
        if (isMonitoringActive) {
            intent.setAction(SoundMonitoringForegroundService.ACTION_STOP);
            requireContext().startService(intent);
            isMonitoringActive = false;
            Toast.makeText(requireContext(), "Sound monitoring stopped.", Toast.LENGTH_SHORT).show();
        } else {
            intent.setAction(SoundMonitoringForegroundService.ACTION_START);
            requireContext().startForegroundService(intent);
            isMonitoringActive = true;
            Toast.makeText(requireContext(), "Live sound monitoring started.", Toast.LENGTH_SHORT).show();
        }
        updateMonitoringStateUI();
    }

    private final Runnable holdRunnable = new Runnable() {
        @Override
        public void run() {
            holdProgress += 100;
            sosHoldProgressBar.setProgress((int) ((holdProgress / (float) HOLD_DURATION_MS) * 100));

            if (holdProgress >= HOLD_DURATION_MS) {
                sosHoldProgressBar.setVisibility(View.INVISIBLE);
                tvSosHoldInstructions.setText("EMERGENCY ACTIVATED!");
                triggerSosEmergency();
            } else {
                holdHandler.postDelayed(this, 100);
            }
        }
    };

    private void startSosHoldTimer() {
        holdProgress = 0;
        sosHoldProgressBar.setProgress(0);
        sosHoldProgressBar.setVisibility(View.VISIBLE);
        tvSosHoldInstructions.setText("Keep holding for 3 seconds...");
        holdHandler.post(holdRunnable);
    }

    private void cancelSosHoldTimer() {
        holdHandler.removeCallbacks(holdRunnable);
        sosHoldProgressBar.setVisibility(View.INVISIBLE);
        tvSosHoldInstructions.setText(R.string.hold_sos_prompt);
    }

    private void triggerSosEmergency() {
        Intent intent = new Intent(requireContext(), EmergencyActivatedActivity.class);
        intent.putExtra("detection_type", "manual_sos");
        intent.putExtra("user_response", "manual_sos");
        startActivity(intent);
    }

    private void dialNumber(String number) {
        Intent intent = new Intent(Intent.ACTION_DIAL);
        intent.setData(Uri.parse("tel:" + number));
        startActivity(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        updateMonitoringStateUI();
        IntentFilter filter = new IntentFilter(SoundMonitoringForegroundService.ACTION_SOUND_LEVEL_BROADCAST);
        requireContext().registerReceiver(soundUpdateReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
    }

    @Override
    public void onPause() {
        super.onPause();
        try {
            requireContext().unregisterReceiver(soundUpdateReceiver);
        } catch (Exception ignored) {}
    }
}
