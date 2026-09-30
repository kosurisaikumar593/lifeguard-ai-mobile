import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, MainTabParamList } from '../types/navigation';
import { Colors } from '../theme/colors';

// Screens
import { SplashScreen } from '../screens/SplashScreen';
import { GetStartedScreen } from '../screens/GetStartedScreen';
import { IntroductionScreen } from '../screens/IntroductionScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { OtpVerificationScreen } from '../screens/OtpVerificationScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { HomeDashboardScreen } from '../screens/HomeDashboardScreen';
import { SoundMonitoringScreen } from '../screens/SoundMonitoringScreen';
import { ManualSOSScreen } from '../screens/ManualSOSScreen';
import { SOSConfirmedScreen } from '../screens/SOSConfirmedScreen';
import { LiveLocationScreen } from '../screens/LiveLocationScreen';
import { EmergencyContactsScreen } from '../screens/EmergencyContactsScreen';
import { AddEditContactScreen } from '../screens/AddEditContactScreen';
import { AlertHistoryScreen } from '../screens/AlertHistoryScreen';
import { IncidentDetailScreen } from '../screens/IncidentDetailScreen';
import { ProfileSettingsScreen } from '../screens/ProfileSettingsScreen';
import { PermissionsScreen } from '../screens/PermissionsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const EmptyScreen: React.FC = () => null;

const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F1F5F9',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 10,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeDashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MonitoringTab"
        component={SoundMonitoringScreen}
        options={{
          tabBarLabel: 'Safety',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={AlertHistoryScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="FamilyTab"
        component={EmergencyContactsScreen}
        options={{
          tabBarLabel: 'Family',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileSettingsScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size || 22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="GetStarted" component={GetStartedScreen} />
      <Stack.Screen name="Introduction" component={IntroductionScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
      <Stack.Screen name="AddEditContact" component={AddEditContactScreen} />
      <Stack.Screen name="SoundMonitoring" component={SoundMonitoringScreen} />
      <Stack.Screen
        name="ManualSOS"
        component={ManualSOSScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen name="SOSConfirmed" component={SOSConfirmedScreen} />
      <Stack.Screen name="LiveLocation" component={LiveLocationScreen} />
      <Stack.Screen name="AlertHistory" component={AlertHistoryScreen} />
      <Stack.Screen name="IncidentDetail" component={IncidentDetailScreen} />
      <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  sosTabButton: {
    top: -16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosTabInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
