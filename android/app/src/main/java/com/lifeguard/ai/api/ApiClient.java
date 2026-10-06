package com.lifeguard.ai.api;

import android.content.Context;
import com.lifeguard.ai.utils.SessionManager;
import java.util.concurrent.TimeUnit;
import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiClient {
    // Default emulator loopback to host machine
    public static final String DEFAULT_BASE_URL = "http://10.0.2.2:5000/";
    
    private static Retrofit retrofit = null;

    public static ApiService getService(Context context) {
        if (retrofit == null) {
            String baseUrl = SessionManager.getInstance(context).getBaseUrl();
            if (baseUrl == null || baseUrl.isEmpty()) {
                baseUrl = DEFAULT_BASE_URL;
            }

            HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
            logging.setLevel(HttpLoggingInterceptor.Level.BODY);

            OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .addInterceptor(logging)
                .addInterceptor(new Interceptor() {
                    @Override
                    public Response intercept(Chain chain) throws java.io.IOException {
                        Request original = chain.request();
                        String token = SessionManager.getInstance(context).getToken();
                        
                        Request.Builder requestBuilder = original.newBuilder();
                        if (token != null && !token.isEmpty()) {
                            requestBuilder.header("Authorization", "Bearer " + token);
                        }
                        
                        return chain.proceed(requestBuilder.build());
                    }
                })
                .build();

            retrofit = new Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build();
        }
        return retrofit.create(ApiService.class);
    }

    public static void resetClient() {
        retrofit = null;
    }
}
