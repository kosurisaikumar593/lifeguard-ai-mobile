package com.lifeguard.ai.api;

import com.lifeguard.ai.models.ApiResponse;
import com.lifeguard.ai.models.EmergencyEvent;
import com.lifeguard.ai.models.SoundAnalysisResult;
import java.util.Map;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.http.*;

public interface ApiService {

    // Authentication
    @POST("api/register")
    Call<ApiResponse<Void>> register(@Body Map<String, String> body);

    @POST("api/verify-otp")
    Call<ApiResponse<Void>> verifyOtp(@Body Map<String, String> body);

    @POST("api/login")
    Call<ApiResponse<Void>> login(@Body Map<String, String> body);

    @POST("api/forgot-password")
    Call<ApiResponse<Void>> forgotPassword(@Body Map<String, String> body);

    @POST("api/reset-password")
    Call<ApiResponse<Void>> resetPassword(@Body Map<String, String> body);

    @GET("api/profile")
    Call<ApiResponse<Void>> getProfile();

    @POST("api/update-fcm-token")
    Call<ApiResponse<Void>> updateFcmToken(@Body Map<String, String> body);

    // Contacts
    @GET("api/contacts")
    Call<ApiResponse<Void>> getContacts();

    @POST("api/contacts/request")
    Call<ApiResponse<Void>> requestContact(@Body Map<String, String> body);

    @POST("api/contacts/accept")
    Call<ApiResponse<Void>> acceptContact(@Body Map<String, Object> body);

    @DELETE("api/contacts/{id}")
    Call<ApiResponse<Void>> removeContact(@Path("id") int contactId);

    // AI Audio Analysis
    @Multipart
    @POST("api/analyze-sound")
    Call<SoundAnalysisResult> analyzeSoundMultipart(@Part MultipartBody.Part audio);

    @POST("api/analyze-sound")
    Call<SoundAnalysisResult> analyzeSoundJson(@Body Map<String, String> body);

    // Emergency Procedures
    @POST("api/emergency/create")
    Call<ApiResponse<Void>> createEmergency(@Body Map<String, Object> body);

    @POST("api/emergency/location")
    Call<ApiResponse<Void>> updateEmergencyLocation(@Body Map<String, Object> body);

    @POST("api/emergency/acknowledge")
    Call<ApiResponse<Void>> acknowledgeEmergency(@Body Map<String, Object> body);

    @GET("api/emergency/history")
    Call<ApiResponse<Void>> getEmergencyHistory();

    @GET("api/emergency/{id}")
    Call<ApiResponse<Void>> getEmergencyById(@Path("id") int id);
}
