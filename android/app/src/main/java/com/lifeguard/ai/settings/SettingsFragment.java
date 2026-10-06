package com.lifeguard.ai.settings;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;
import com.lifeguard.ai.R;
import com.lifeguard.ai.auth.LoginActivity;
import com.lifeguard.ai.auth.PermissionSetupActivity;
import com.lifeguard.ai.utils.SessionManager;

public class SettingsFragment extends Fragment {

    private TextView tvSettingsUserName, tvSettingsUserMobile, tvSettingsAvatar;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_settings, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        tvSettingsUserName = view.findViewById(R.id.tvSettingsUserName);
        tvSettingsUserMobile = view.findViewById(R.id.tvSettingsUserMobile);
        tvSettingsAvatar = view.findViewById(R.id.tvSettingsAvatar);

        View btnSettingProfile = view.findViewById(R.id.btnSettingProfile);
        View btnSettingMonitoring = view.findViewById(R.id.btnSettingMonitoring);
        View btnSettingDayNight = view.findViewById(R.id.btnSettingDayNight);
        View btnSettingNotifications = view.findViewById(R.id.btnSettingNotifications);
        View btnSettingPermissions = view.findViewById(R.id.btnSettingPermissions);
        View btnSettingPrivacy = view.findViewById(R.id.btnSettingPrivacy);
        View btnSettingHelp = view.findViewById(R.id.btnSettingHelp);
        View btnSettingAbout = view.findViewById(R.id.btnSettingAbout);
        Button btnLogout = view.findViewById(R.id.btnLogout);

        SessionManager session = SessionManager.getInstance(requireContext());
        String name = session.getUserName();
        tvSettingsUserName.setText(name);
        tvSettingsUserMobile.setText(session.getUserMobile());

        String initials = "SK";
        if (name != null && !name.isEmpty()) {
            String[] parts = name.split(" ");
            if (parts.length > 1) {
                initials = ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
            } else {
                initials = ("" + name.charAt(0)).toUpperCase();
            }
        }
        tvSettingsAvatar.setText(initials);

        btnSettingProfile.setOnClickListener(v -> startActivity(new Intent(requireContext(), ProfileActivity.class)));
        btnSettingMonitoring.setOnClickListener(v -> startActivity(new Intent(requireContext(), MonitoringSettingsActivity.class)));
        btnSettingDayNight.setOnClickListener(v -> startActivity(new Intent(requireContext(), DayNightSettingsActivity.class)));
        btnSettingNotifications.setOnClickListener(v -> startActivity(new Intent(requireContext(), NotificationSettingsActivity.class)));
        btnSettingPermissions.setOnClickListener(v -> startActivity(new Intent(requireContext(), PermissionSetupActivity.class)));
        btnSettingPrivacy.setOnClickListener(v -> startActivity(new Intent(requireContext(), PrivacyActivity.class)));
        btnSettingHelp.setOnClickListener(v -> startActivity(new Intent(requireContext(), HelpSafetyActivity.class)));
        btnSettingAbout.setOnClickListener(v -> startActivity(new Intent(requireContext(), AboutActivity.class)));

        btnLogout.setOnClickListener(v -> {
            new AlertDialog.Builder(requireContext())
                .setTitle("Log Out")
                .setMessage("Are you sure you want to log out of LifeGuard AI?")
                .setPositiveButton("Log Out", (dialog, which) -> {
                    SessionManager.getInstance(requireContext()).logout();
                    Intent loginIntent = new Intent(requireContext(), LoginActivity.class);
                    loginIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(loginIntent);
                })
                .setNegativeButton("Cancel", null)
                .show();
        });
    }
}
