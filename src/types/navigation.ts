import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  HomeTab: undefined;
  MonitoringTab: undefined;
  HistoryTab: undefined;
  FamilyTab: undefined;
  SOSTab?: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  GetStarted: undefined;
  Introduction: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  OtpVerification: {
    mobileNumber: string;
    maskedMobile: string;
    devOtp?: string;
  };
  ResetPassword: {
    mobileNumber: string;
    resetToken: string;
  };
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  HomeDashboard: undefined;
  EmergencyContacts: undefined;
  AddEditContact: {
    contactId?: string;
  } | undefined;
  SoundMonitoring: undefined;
  ManualSOS: undefined;
  SOSConfirmed: undefined;
  LiveLocation: undefined;
  AlertHistory: undefined;
  IncidentDetail: {
    incidentId: string;
  };
  ProfileSettings: undefined;
  Permissions: undefined;
};
