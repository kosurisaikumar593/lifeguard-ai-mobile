package com.lifeguard.ai.home;

import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.lifeguard.ai.R;
import com.lifeguard.ai.contacts.ContactsFragment;
import com.lifeguard.ai.history.HistoryFragment;
import com.lifeguard.ai.monitoring.MonitoringFragment;
import com.lifeguard.ai.settings.SettingsFragment;

public class MainActivity extends AppCompatActivity {

    private BottomNavigationView bottomNavigationView;

    private final Fragment homeFragment = new HomeFragment();
    private final Fragment monitoringFragment = new MonitoringFragment();
    private final Fragment contactsFragment = new ContactsFragment();
    private final Fragment historyFragment = new HistoryFragment();
    private final Fragment settingsFragment = new SettingsFragment();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bottomNavigationView = findViewById(R.id.bottomNavigationView);

        bottomNavigationView.setOnItemSelectedListener(item -> {
            Fragment selectedFragment = null;
            int itemId = item.getItemId();

            if (itemId == R.id.navigation_home) {
                selectedFragment = homeFragment;
            } else if (itemId == R.id.navigation_monitoring) {
                selectedFragment = monitoringFragment;
            } else if (itemId == R.id.navigation_contacts) {
                selectedFragment = contactsFragment;
            } else if (itemId == R.id.navigation_history) {
                selectedFragment = historyFragment;
            } else if (itemId == R.id.navigation_settings) {
                selectedFragment = settingsFragment;
            }

            if (selectedFragment != null) {
                getSupportFragmentManager().beginTransaction()
                    .replace(R.id.fragmentContainer, selectedFragment)
                    .commit();
                return true;
            }
            return false;
        });

        // Handle intent extras if opened from a notification
        String openTab = getIntent().getStringExtra("open_tab");
        if ("contacts".equalsIgnoreCase(openTab)) {
            navigateToTab(R.id.navigation_contacts);
        } else {
            // Default to Home
            getSupportFragmentManager().beginTransaction()
                .replace(R.id.fragmentContainer, homeFragment)
                .commit();
        }
    }

    public void navigateToTab(int menuItemId) {
        if (bottomNavigationView != null) {
            bottomNavigationView.setSelectedItemId(menuItemId);
        }
    }
}
